/**
 * useFileStream — P2P File Transfer via WebRTC Data Channel
 *
 * Simple strategy: collect ALL chunks, assemble once at 100%, then call
 * onFileReady. No partial blobs, no progressive playback, no restarts.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const CHUNK_SIZE = 64 * 1024;      // 64 KB
const MAX_BUFFER = 8 * 1024 * 1024; // pause sender when buffered > 8 MB

/**
 * Map file extension → browser-safe MIME type.
 * MKV must be 'video/webm' or Chrome won't initialise its audio decoder.
 */
const resolveMimeType = (fileName, rawType) => {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const map = {
    mkv: 'video/webm', webm: 'video/webm',
    mp4: 'video/mp4',  m4v:  'video/mp4', mov: 'video/mp4',
    avi: 'video/x-msvideo',
    ogg: 'video/ogg',  ogv:  'video/ogg',
    mp3: 'audio/mpeg', wav:  'audio/wav',
    flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
  };
  return map[ext] || (rawType && rawType !== 'video/x-matroska' ? rawType : 'video/mp4');
};

export const useFileStream = ({ socketRef, roomCode, onFileReady, onProgress }) => {
  // ── Sender ────────────────────────────────────────────────────────
  const senderPCRef      = useRef(null);
  const senderChannelRef = useRef(null);
  const fileRef          = useRef(null);
  const sendOffsetRef    = useRef(0);
  const sentChunksRef    = useRef(0);
  const totalChunksRef   = useRef(0);
  const isPausedRef      = useRef(false);

  // ── Receiver ──────────────────────────────────────────────────────
  const receiverPCRef     = useRef(null);
  const chunksRef         = useRef([]);
  const receivedBytesRef  = useRef(0);
  const metaRef           = useRef(null);

  // ── Stable callback refs ──────────────────────────────────────────
  const onFileReadyRef = useRef(onFileReady);
  const onProgressRef  = useRef(onProgress);
  useEffect(() => { onFileReadyRef.current = onFileReady; }, [onFileReady]);
  useEffect(() => { onProgressRef.current  = onProgress;  }, [onProgress]);

  // ── UI state ──────────────────────────────────────────────────────
  const [sendProgress,   setSendProgress]   = useState(0);
  const [recvProgress,   setRecvProgress]   = useState(0);
  const [streamStatus,   setStreamStatus]   = useState('idle');
  const [streamFileName, setStreamFileName] = useState('');
  const [streamFileSize, setStreamFileSize] = useState(0);

  // ── Helpers ───────────────────────────────────────────────────────
  const safeClose = (ref) => { try { ref.current?.close(); } catch (_) {} ref.current = null; };
  const sendJSON  = (ch, obj) => { if (ch?.readyState === 'open') ch.send(JSON.stringify(obj)); };
  const getSocket = () => socketRef?.current ?? null;

  // ── SENDER: send next chunk ───────────────────────────────────────
  const sendNextChunkRef = useRef(null);
  sendNextChunkRef.current = () => {
    const file = fileRef.current;
    const ch   = senderChannelRef.current;
    if (!file || !ch || ch.readyState !== 'open') return;

    if (sendOffsetRef.current >= file.size) {
      sendJSON(ch, { type: 'FILE_END' });
      setStreamStatus('ready');
      setSendProgress(100);
      console.log('✅ Send complete');
      return;
    }

    if (ch.bufferedAmount > MAX_BUFFER) { isPausedRef.current = true; return; }

    const slice  = file.slice(sendOffsetRef.current, sendOffsetRef.current + CHUNK_SIZE);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (ch.readyState !== 'open') return;
      const buf = e.target.result;
      sendJSON(ch, { type: 'FILE_CHUNK', index: sentChunksRef.current, total: totalChunksRef.current });
      ch.send(buf);
      sendOffsetRef.current += buf.byteLength;
      sentChunksRef.current += 1;
      const pct = Math.round((sendOffsetRef.current / file.size) * 100);
      setSendProgress(pct);
      onProgressRef.current?.({ direction: 'send', percent: pct });
      if (ch.bufferedAmount > MAX_BUFFER) { isPausedRef.current = true; }
      else { setTimeout(() => sendNextChunkRef.current?.(), 0); }
    };
    reader.readAsArrayBuffer(slice);
  };

  const beginSendRef = useRef(null);
  beginSendRef.current = () => {
    const file = fileRef.current;
    const ch   = senderChannelRef.current;
    if (!file || !ch) return;
    sendOffsetRef.current = 0;
    sentChunksRef.current = 0;
    totalChunksRef.current = Math.ceil(file.size / CHUNK_SIZE);
    const mimeType = resolveMimeType(file.name, file.type);
    console.log(`📋 Sending: ${file.name} → ${mimeType}`);
    sendJSON(ch, { type: 'FILE_META', name: file.name, size: file.size, mimeType });
    sendNextChunkRef.current();
  };

  // ── SENDER: create PC ─────────────────────────────────────────────
  const createSenderPC = useCallback(() => {
    safeClose(senderPCRef);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    senderPCRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      const s = getSocket();
      if (candidate && s) s.emit('file-rtc-ice', { roomCode, candidate, role: 'sender' });
    };
    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState))
        setStreamStatus(s => s === 'sending' ? 'error' : s);
    };

    const ch = pc.createDataChannel('fileStream', { ordered: true });
    ch.binaryType = 'arraybuffer';
    ch.bufferedAmountLowThreshold = 512 * 1024;
    senderChannelRef.current = ch;

    ch.onopen = () => { setStreamStatus('sending'); beginSendRef.current(); };
    ch.onbufferedamountlow = () => {
      if (isPausedRef.current) { isPausedRef.current = false; sendNextChunkRef.current(); }
    };
    ch.onerror = () => setStreamStatus('error');
    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // ── RECEIVER: handle data channel messages ────────────────────────
  const setupReceiverChannel = useCallback((ch) => {
    chunksRef.current        = [];
    receivedBytesRef.current = 0;
    metaRef.current          = null;

    ch.onmessage = ({ data }) => {
      if (typeof data === 'string') {
        let msg; try { msg = JSON.parse(data); } catch { return; }

        if (msg.type === 'FILE_META') {
          metaRef.current          = msg;
          chunksRef.current        = [];
          receivedBytesRef.current = 0;
          setStreamFileName(msg.name);
          setStreamFileSize(msg.size);
          setStreamStatus('receiving');
          setRecvProgress(0);
          console.log(`📥 Receiving: ${msg.name} (${(msg.size / 1024 / 1024).toFixed(1)} MB)`);

        } else if (msg.type === 'FILE_END') {
          // ── Assemble complete blob then notify ──
          const meta = metaRef.current;
          if (!meta) return;
          setStreamStatus('assembling');
          try {
            const blob = new Blob(chunksRef.current, { type: meta.mimeType });
            const url  = URL.createObjectURL(blob);
            setStreamStatus('ready');
            setRecvProgress(100);
            console.log(`✅ Assembled: ${meta.name} — ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
            onFileReadyRef.current?.({ url, name: meta.name, type: meta.mimeType, size: blob.size });
            chunksRef.current = []; // free memory
          } catch (err) {
            console.error('Assembly error:', err);
            setStreamStatus('error');
          }

        } else if (msg.type === 'FILE_CANCEL') {
          setStreamStatus('cancelled');
          chunksRef.current = [];
        }

      } else if (data instanceof ArrayBuffer) {
        chunksRef.current.push(data);
        receivedBytesRef.current += data.byteLength;
        const meta = metaRef.current;
        if (meta?.size) {
          const pct = Math.min(99, Math.round((receivedBytesRef.current / meta.size) * 100));
          setRecvProgress(pct);
          onProgressRef.current?.({ direction: 'recv', percent: pct });
        }
      }
    };

    ch.onerror = () => setStreamStatus('error');
  }, []);

  // ── RECEIVER: create PC ───────────────────────────────────────────
  const createReceiverPC = useCallback(() => {
    safeClose(receiverPCRef);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    receiverPCRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      const s = getSocket();
      if (candidate && s) s.emit('file-rtc-ice', { roomCode, candidate, role: 'receiver' });
    };
    pc.ondatachannel = ({ channel }) => {
      channel.binaryType = 'arraybuffer';
      setupReceiverChannel(channel);
    };
    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, setupReceiverChannel]);

  // ── Public API ────────────────────────────────────────────────────
  const startStreaming = useCallback(async (file) => {
    const s = getSocket();
    if (!s) { console.error('startStreaming: no socket'); return; }
    if (!file) return;
    setStreamStatus('offering');
    setStreamFileName(file.name);
    setStreamFileSize(file.size);
    setSendProgress(0);
    fileRef.current = file;
    const pc    = createSenderPC();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    s.emit('file-rtc-offer', { roomCode, offer });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, createSenderPC]);

  const handleFileOffer = useCallback(async (offer) => {
    const s = getSocket();
    if (!s) { console.error('handleFileOffer: no socket'); return; }
    const pc = createReceiverPC();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    s.emit('file-rtc-answer', { roomCode, answer });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, createReceiverPC]);

  const handleFileAnswer = useCallback(async (answer) => {
    const pc = senderPCRef.current;
    if (pc && pc.signalingState !== 'stable')
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleFileIce = useCallback(async ({ candidate, role }) => {
    const pc = role === 'sender' ? receiverPCRef.current : senderPCRef.current;
    if (pc && candidate) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
  }, []);

  const cancelStream = useCallback(() => {
    sendJSON(senderChannelRef.current, { type: 'FILE_CANCEL' });
    safeClose(senderPCRef);
    safeClose(receiverPCRef);
    fileRef.current  = null;
    chunksRef.current = [];
    setStreamStatus('idle');
    setSendProgress(0);
    setRecvProgress(0);
  }, []);

  const resetStream = useCallback(() => {
    safeClose(senderPCRef);
    safeClose(receiverPCRef);
    fileRef.current  = null;
    chunksRef.current = [];
    setStreamStatus('idle');
    setSendProgress(0);
    setRecvProgress(0);
    setStreamFileName('');
    setStreamFileSize(0);
  }, []);

  // No-op stubs so room page doesn't need to change
  const forceRefresh = useCallback(() => {}, []);

  useEffect(() => () => { safeClose(senderPCRef); safeClose(receiverPCRef); }, []);

  return {
    startStreaming,
    handleFileOffer,
    handleFileAnswer,
    handleFileIce,
    cancelStream,
    resetStream,
    forceRefresh,
    streamStatus,
    sendProgress,
    recvProgress,
    streamFileName,
    streamFileSize,
    isSending:     ['offering', 'sending'].includes(streamStatus),
    isReceiving:   ['receiving', 'assembling'].includes(streamStatus),
    isStreamReady: streamStatus === 'ready',
  };
};
