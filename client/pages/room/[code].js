import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSocket } from '../../hooks/useSocket';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useFileStream } from '../../hooks/useFileStream';
import VideoPlayer from '../../components/VideoPlayer';
import ChatPanel from '../../components/ChatPanel';
import VideoCallPanel from '../../components/VideoCallPanel';
import MediaUpload from '../../components/MediaUpload';
import UserStatus from '../../components/UserStatus';
import StreamProgress from '../../components/StreamProgress';

export default function RoomPage() {
  const router = useRouter();
  const { code: roomCode } = router.query;

  const { connect, disconnect, isConnected, latency } = useSocket();

  // ─── Core room state ────────────────────────────────────────────
  // const [mySocketId, setMySocketId] = useState('');
  // const [isHost, setIsHost] = useState(false);
  // const [partnerConnected, setPartnerConnected] = useState(false);
  // const [partnerSocketId, setPartnerSocketId] = useState('');

  const [mySocketId, setMySocketId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [myRole, setMyRole] = useState('');
  const [partnerRole, setPartnerRole] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerSocketId, setPartnerSocketId] = useState('');
  const [userCount, setUserCount] = useState(1);

  // ─── Media state ────────────────────────────────────────────────
  const [mediaData, setMediaData] = useState(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [partnerBuffering, setPartnerBuffering] = useState(false);

  // ─── UI state ───────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sidePanel, setSidePanel] = useState('chat');

  // Refs for stale-closure-safe access inside socket handlers
  const socketRef = useRef(null);
  const partnerConnectedRef = useRef(false);
  const mediaDataRef = useRef(null);

  useEffect(() => { partnerConnectedRef.current = partnerConnected; }, [partnerConnected]);
  useEffect(() => { mediaDataRef.current = mediaData; }, [mediaData]);

  // ─── File streaming ─────────────────────────────────────────────
  const {
    startStreaming,
    handleFileOffer,
    handleFileAnswer,
    handleFileIce,
    cancelStream,
    streamStatus,
    sendProgress,
    recvProgress,
    streamFileName,
    streamFileSize,
    isReceiving,
    forceRefresh,
  } = useFileStream({
    socketRef,
    roomCode,
    // Called when first blob is ready (15 MB threshold) AND on final assembly
    onFileReady: ({ url, name, type, size, isPartial }) => {
      setMediaData((prev) => ({
        ...(prev || {}),
        url,
        name: name || prev?.name || '',
        type: type || prev?.type || '',
        size: size || prev?.size || 0,
        file: prev?.file, // keep original File ref for re-streaming
      }));
      if (!isPartial) {
        // Final complete file — request sync once
        setTimeout(() => {
          socketRef.current?.emit('request-sync', { roomCode });
        }, 300);
      }
    },
  });

  // Keep startStreaming accessible in socket callbacks
  const startStreamingRef = useRef(startStreaming);
  useEffect(() => { startStreamingRef.current = startStreaming; }, [startStreaming]);

  // ─── WebRTC video call ──────────────────────────────────────────
  const {
    localStream, remoteStream, isCallActive, isMuted, isCameraOff,
    callStatus, availableDevices, selectedCamera, selectedMic,
    setSelectedCamera, setSelectedMic,
    getDevices, startCall, handleOffer, handleAnswer, handleIceCandidate,
    endCall, toggleMute, toggleCamera,
  } = useWebRTC({ socketRef, roomCode, onDataChannelMessage: null });

  // ─── Socket initialization (runs once per roomCode) ─────────────
  useEffect(() => {
    if (!roomCode) return;

    const socket = connect();
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit('join-room', { roomCode });
    };

    const onRoomJoined = ({ socketId, isHost: host, userCount }) => {
      setMySocketId(socketId);
      setIsHost(host);
      if (userCount === 2) {
        setPartnerConnected(true);
        partnerConnectedRef.current = true;
        setTimeout(() => socket.emit('request-sync', { roomCode }), 500);
      }
    };

    const onUserJoined = ({ socketId }) => {
      setPartnerConnected(true);
      partnerConnectedRef.current = true;
      setPartnerSocketId(socketId);

      const currentMedia = mediaDataRef.current;
      if (currentMedia) {
        // Announce the file and auto-stream if we have the raw File object
        socket.emit('file-stream-available', {
          roomCode,
          fileName: currentMedia.name,
          fileSize: currentMedia.size,
          fileType: currentMedia.type,
        });
        if (currentMedia.file) {
          setTimeout(() => startStreamingRef.current?.(currentMedia.file), 800);
        }
      }
    };

    const onUserLeft = () => {
      setPartnerConnected(false);
      partnerConnectedRef.current = false;
      setPartnerSocketId('');
      setPartnerBuffering(false);
    };

    const onPartnerBuffering = ({ buffering }) => setPartnerBuffering(buffering);
    const onError = ({ message }) => { setError(message); setTimeout(() => router.push('/'), 3000); };
    const onKicked = ({ reason }) => { setError(`Disconnected: ${reason}`); setTimeout(() => router.push('/'), 3000); };

    // File stream signaling
    const onFileOffer = ({ offer }) => handleFileOffer(offer);
    const onFileAnswer = ({ answer }) => handleFileAnswer(answer);
    const onFileIce = ({ candidate, role }) => handleFileIce({ candidate, role });

    // Video call signaling
    const onCallOffer = ({ offer, fromSocketId }) => { setIncomingOffer({ offer, fromSocketId }); setIncomingCall({ fromSocketId }); };
    const onCallAnswer = ({ answer }) => handleAnswer(answer);
    const onCallIce = ({ candidate }) => handleIceCandidate(candidate);
    const onCallEnded = () => { endCall(); setSidePanel('chat'); };

    if (socket.connected) onConnect();
    else socket.on('connect', onConnect);

    socket.on('room-joined', onRoomJoined);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('media-buffering', onPartnerBuffering);
    socket.on('error', onError);
    socket.on('kicked', onKicked);
    socket.on('file-rtc-offer', onFileOffer);
    socket.on('file-rtc-answer', onFileAnswer);
    socket.on('file-rtc-ice', onFileIce);
    socket.on('webrtc-offer', onCallOffer);
    socket.on('webrtc-answer', onCallAnswer);
    socket.on('webrtc-ice-candidate', onCallIce);
    socket.on('webrtc-call-ended', onCallEnded);

    getDevices();

    return () => {
      socket.off('connect', onConnect);
      socket.off('room-joined', onRoomJoined);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('media-buffering', onPartnerBuffering);
      socket.off('error', onError);
      socket.off('kicked', onKicked);
      socket.off('file-rtc-offer', onFileOffer);
      socket.off('file-rtc-answer', onFileAnswer);
      socket.off('file-rtc-ice', onFileIce);
      socket.off('webrtc-offer', onCallOffer);
      socket.off('webrtc-answer', onCallAnswer);
      socket.off('webrtc-ice-candidate', onCallIce);
      socket.off('webrtc-call-ended', onCallEnded);
      socket.emit('leave-room');
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // ─── Handle local file upload ─────────────────────────────────
  const handleMediaLoaded = useCallback((data) => {
    if (!data) { setMediaData(null); return; }

    // Store File object so we can re-stream when partner joins later
    setMediaData(data);

    if (partnerConnectedRef.current && data.file) {
      socketRef.current?.emit('file-stream-available', {
        roomCode,
        fileName: data.name,
        fileSize: data.size,
        fileType: data.type,
      });
      setTimeout(() => startStreamingRef.current?.(data.file), 300);
    }
  }, [roomCode]);

  // ─── Call handlers ────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingOffer) return;
    await handleOffer(incomingOffer.offer);
    setIncomingCall(null);
    setIncomingOffer(null);
    setSidePanel('call');
  }, [incomingOffer, handleOffer]);

  const rejectCall = useCallback(() => { setIncomingCall(null); setIncomingOffer(null); }, []);

  const handleStartCall = useCallback(async (withVideo) => {
    setSidePanel('call');
    await startCall(withVideo);
  }, [startCall]);

  const handleCopyCode = useCallback(() => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomCode]);

  const leaveRoom = useCallback(() => {
    cancelStream();
    endCall();
    disconnect();
    router.push('/');
  }, [cancelStream, endCall, disconnect, router]);

  // ─── Derived state ─────────────────────────────────────────────
  const isActivelyStreaming = ['offering', 'sending', 'receiving', 'assembling'].includes(streamStatus);

  // ─── Error / loading screens ───────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-text-primary">{error}</h2>
          <p className="text-text-secondary text-sm">Redirecting to home…</p>
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="loading-dot w-3 h-3 rounded-full bg-amber-400" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Room {roomCode} — WatchTogether</title></Head>

      <div className="h-screen bg-void flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-abyss flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={leaveRoom} className="flex items-center gap-2 px-3 py-1.5 rounded-lg btn-ghost text-sm font-display">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Leave</span>
            </button>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className="font-display font-semibold text-sm text-text-primary hidden sm:block">WatchTogether</span>
              <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{roomCode}</span>
            </div>
          </div>

          {/* Center status pill */}
          <div className="flex items-center gap-2">
            {isActivelyStreaming ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-400 font-mono">
                  {sendProgress > 0 ? `Streaming · ${sendProgress}%` : `Receiving · ${recvProgress}%`}
                </span>
              </>
            ) : (
              <>
                <div className={`w-1.5 h-1.5 rounded-full ${partnerConnected ? 'bg-emerald-400' : 'bg-text-muted'}`} />
                <span className="text-xs text-text-muted font-mono">
                  {partnerConnected ? '2/2 · Synced' : '1/2 · Waiting for partner'}
                </span>
              </>
            )}
          </div>

          {/* Panel tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: 'chat', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
              { id: 'call', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
              { id: 'status', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
            ].map(({ id, icon }) => (
              <button
                key={id}
                onClick={() => setSidePanel(id)}
                className={`p-2 rounded-lg transition-colors ${sidePanel === id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-text-muted hover:text-text-primary hover:bg-panel'}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Left: video area */}
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden min-w-0">

            {/* Stream progress banner (sender & receiver) */}
            {isActivelyStreaming && (
              <div className="flex-shrink-0">
                <StreamProgress
                  status={streamStatus}
                  fileName={streamFileName}
                  fileSize={streamFileSize}
                  sendProgress={sendProgress}
                  recvProgress={recvProgress}
                  onCancel={cancelStream}

                />
              </div>
            )}

            {/* Send complete notice */}
            {streamStatus === 'ready' && sendProgress === 100 && !isReceiving && (
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-fade-in">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-emerald-300 font-display">
                  Media streamed to partner — playback is now synced!
                </p>
              </div>
            )}

            {/* Video player */}
            <div className="flex-1 min-h-0">
              <VideoPlayer
                mediaUrl={mediaData?.url}
                mediaType={mediaData?.type}
                socket={socketRef.current}
                roomCode={roomCode}
                isHost={isHost}
                onBuffering={(buf) => {
                  setIsBuffering(buf);
                  socketRef.current?.emit('media-buffering', { roomCode, buffering: buf });
                }}
              />
            </div>

            {/* Bottom area: upload OR receiving indicator */}
            <div className="flex-shrink-0">
              {isReceiving ? (
                /* Receiving state — replaces the upload panel */
                <div className="flex items-center gap-3 px-4 py-4 bg-surface border border-cyan-500/20 rounded-xl">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-abyss animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-text-primary">Receiving stream…</p>
                    <p className="text-xs text-text-muted truncate">
                      {streamFileName || 'Media'} — player will load automatically when ready
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-mono font-bold text-cyan-400">{recvProgress}%</p>
                    <p className="text-[10px] text-text-muted">received</p>
                  </div>
                </div>
              ) : (
                /* Normal upload panel */
                <MediaUpload
                  onMediaLoaded={handleMediaLoaded}
                  socket={socketRef.current}
                  roomCode={roomCode}
                  partnerConnected={partnerConnected}
                  isStreaming={isActivelyStreaming}
                />
              )}
            </div>
          </div>

          {/* Right: side panel */}
          <div className="w-80 xl:w-96 flex-shrink-0 p-4 flex flex-col gap-3 overflow-hidden border-l border-border">
            {sidePanel === 'chat' && (
              <div className="flex-1 min-h-0">
                <ChatPanel socket={socketRef.current} roomCode={roomCode} mySocketId={mySocketId} partnerConnected={partnerConnected} />
              </div>
            )}
            {sidePanel === 'call' && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <VideoCallPanel
                  localStream={localStream} remoteStream={remoteStream} isCallActive={isCallActive}
                  isMuted={isMuted} isCameraOff={isCameraOff} callStatus={callStatus}
                  availableDevices={availableDevices} selectedCamera={selectedCamera} selectedMic={selectedMic}
                  setSelectedCamera={setSelectedCamera} setSelectedMic={setSelectedMic}
                  onStartCall={handleStartCall} onEndCall={endCall} onToggleMute={toggleMute}
                  onToggleCamera={toggleCamera} partnerConnected={partnerConnected}
                />
              </div>
            )}
            {sidePanel === 'status' && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <UserStatus
                  mySocketId={mySocketId} partnerConnected={partnerConnected} partnerSocketId={partnerSocketId}
                  isBuffering={isBuffering} partnerBuffering={partnerBuffering} latency={latency}
                  roomCode={roomCode} onCopyCode={handleCopyCode} copied={copied}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Incoming call toast ── */}
      {incomingCall && !isCallActive && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="bg-panel border border-cyan-500/30 rounded-2xl p-4 shadow-panel max-w-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center animate-pulse">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-display font-semibold text-text-primary text-sm">Incoming Call</p>
                <p className="text-xs text-text-secondary">Your partner wants to video chat</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={acceptCall} className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-sm font-display font-medium transition-colors">Accept</button>
              <button onClick={rejectCall} className="flex-1 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-sm font-display font-medium transition-colors">Decline</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
