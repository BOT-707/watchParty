/**
 * useWebRTC — P2P audio/video calls
 * Accepts socketRef (the ref object) so callbacks always read the live socket.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useWebRTC = ({ socket: socketProp, socketRef: socketRefProp, roomCode, onDataChannelMessage }) => {
  // Support both socketRef (preferred) and legacy socket prop
  const internalSocketRef = useRef(socketProp);
  useEffect(() => { internalSocketRef.current = socketProp; }, [socketProp]);
  const getSocket = () => socketRefProp?.current ?? internalSocketRef.current ?? null;

  const peerConnectionRef = useRef(null);
  const localStreamRef    = useRef(null);
  const dataChannelRef    = useRef(null);

  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isCameraOff,  setIsCameraOff]  = useState(false);
  const [callStatus,   setCallStatus]   = useState('idle');
  const [availableDevices, setAvailableDevices] = useState({ cameras: [], microphones: [] });
  const [selectedCamera, setSelectedCamera]     = useState('');
  const [selectedMic,    setSelectedMic]        = useState('');
  const [dataChannelState, setDataChannelState] = useState('closed');

  const getDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras      = devices.filter((d) => d.kind === 'videoinput');
      const microphones  = devices.filter((d) => d.kind === 'audioinput');
      setAvailableDevices({ cameras, microphones });
      if (cameras.length     && !selectedCamera) setSelectedCamera(cameras[0].deviceId);
      if (microphones.length && !selectedMic)    setSelectedMic(microphones[0].deviceId);
    } catch (err) {
      console.error('Error enumerating devices:', err);
    }
  }, [selectedCamera, selectedMic]);

  const getLocalStream = useCallback(async (audioOnly = false) => {
    try {
      const constraints = {
        video: audioOnly ? false : (selectedCamera ? { deviceId: { exact: selectedCamera } } : true),
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Error getting local stream:', err);
      throw err;
    }
  }, [selectedCamera, selectedMic]);

  const setupDataChannel = useCallback((channel) => {
    channel.binaryType = 'arraybuffer';
    channel.onopen    = () => setDataChannelState('open');
    channel.onclose   = () => setDataChannelState('closed');
    channel.onerror   = (e) => console.error('Data channel error:', e);
    channel.onmessage = (e) => onDataChannelMessage?.(e.data);
  }, [onDataChannelMessage]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      const socket = getSocket();
      if (candidate && socket) {
        socket.emit('webrtc-ice-candidate', { roomCode, candidate });
      }
    };

    pc.ontrack = ({ streams: [stream] }) => setRemoteStream(stream);

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected')                                     { setCallStatus('connected'); setIsCallActive(true); }
      if (['disconnected', 'failed', 'closed'].includes(s))     { setCallStatus('ended'); setIsCallActive(false); }
    };

    pc.ondatachannel = ({ channel }) => {
      setupDataChannel(channel);
      dataChannelRef.current = channel;
    };

    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, setupDataChannel]);

  const startCall = useCallback(async (withVideo = true) => {
    const socket = getSocket();
    if (!socket) { console.error('startCall: no socket'); return; }

    try {
      setCallStatus('calling');
      const stream = await getLocalStream(!withVideo);
      const pc     = createPeerConnection();

      const dc = pc.createDataChannel('callData', { ordered: true });
      setupDataChannel(dc);
      dataChannelRef.current = dc;

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: withVideo });
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { roomCode, offer });
    } catch (err) {
      console.error('startCall error:', err);
      setCallStatus('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, getLocalStream, createPeerConnection, setupDataChannel]);

  const handleOffer = useCallback(async (offer) => {
    const socket = getSocket();
    if (!socket) { console.error('handleOffer: no socket'); return; }

    try {
      setCallStatus('calling');
      const stream = await getLocalStream(false);
      const pc     = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { roomCode, answer });
    } catch (err) {
      console.error('handleOffer error:', err);
      setCallStatus('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, getLocalStream, createPeerConnection]);

  const handleAnswer = useCallback(async (answer) => {
    const pc = peerConnectionRef.current;
    if (pc && pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    const pc = peerConnectionRef.current;
    if (pc && candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    }
  }, []);

  const endCall = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    setCallStatus('idle');
    setIsMuted(false);
    setIsCameraOff(false);
    setDataChannelState('closed');

    const socket = getSocket();
    socket?.emit('webrtc-call-ended', { roomCode });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((v) => !v);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsCameraOff((v) => !v);
  }, []);

  const sendData = useCallback((data) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(data);
      return true;
    }
    return false;
  }, []);

  useEffect(() => () => endCall(), []); // eslint-disable-line

  return {
    localStream, remoteStream, isCallActive, isMuted, isCameraOff,
    callStatus, availableDevices, selectedCamera, selectedMic, dataChannelState,
    setSelectedCamera, setSelectedMic,
    getDevices, startCall, handleOffer, handleAnswer, handleIceCandidate,
    endCall, toggleMute, toggleCamera, sendData,
  };
};
