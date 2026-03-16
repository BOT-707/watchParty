import { useRef, useCallback, useEffect } from 'react';

const SYNC_THRESHOLD = 0.5; // seconds of drift before forced resync
const EMIT_DEBOUNCE = 100; // ms

export const usePlaybackSync = ({ socket, roomCode, videoRef, isHost }) => {
  const isSyncingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  const pendingSyncRef = useRef(null);

  // Helper to safely set video time
  const safeSeek = useCallback((time) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (isFinite(time) && time >= 0 && time <= video.duration) {
      video.currentTime = time;
    }
  }, [videoRef]);

  // Emit play event with latency compensation
  const emitPlay = useCallback((currentTime) => {
    if (!socket) return;
    const now = Date.now();
    if (now - lastEmitTimeRef.current < EMIT_DEBOUNCE) return;
    lastEmitTimeRef.current = now;

    socket.emit('playback-play', {
      roomCode,
      currentTime,
      timestamp: now,
    });
  }, [socket, roomCode]);

  // Emit pause event
  const emitPause = useCallback((currentTime) => {
    if (!socket) return;
    socket.emit('playback-pause', {
      roomCode,
      currentTime,
      timestamp: Date.now(),
    });
  }, [socket, roomCode]);

  // Emit seek event
  const emitSeek = useCallback((currentTime) => {
    if (!socket) return;
    socket.emit('playback-seek', {
      roomCode,
      currentTime,
      timestamp: Date.now(),
    });
  }, [socket, roomCode]);

  // Emit stop
  const emitStop = useCallback(() => {
    if (!socket) return;
    socket.emit('playback-stop', { roomCode });
  }, [socket, roomCode]);

  // Emit speed change
  const emitSpeed = useCallback((speed) => {
    if (!socket) return;
    socket.emit('playback-speed', { roomCode, speed });
  }, [socket, roomCode]);

  // Handle incoming play from peer
  const handleRemotePlay = useCallback(({ currentTime, timestamp }) => {
    if (!videoRef.current) return;
    isSyncingRef.current = true;

    const video = videoRef.current;

    // Compensate for network latency
    const latency = (Date.now() - timestamp) / 1000;
    const compensatedTime = currentTime + latency;

    const drift = Math.abs(video.currentTime - compensatedTime);
    if (drift > SYNC_THRESHOLD) {
      safeSeek(compensatedTime);
    }

    video.play().catch((e) => console.warn('Autoplay prevented:', e));

    setTimeout(() => { isSyncingRef.current = false; }, 200);
  }, [videoRef, safeSeek]);

  // Handle incoming pause from peer
  const handleRemotePause = useCallback(({ currentTime }) => {
    if (!videoRef.current) return;
    isSyncingRef.current = true;

    const video = videoRef.current;
    const drift = Math.abs(video.currentTime - currentTime);
    if (drift > SYNC_THRESHOLD) {
      safeSeek(currentTime);
    }
    video.pause();

    setTimeout(() => { isSyncingRef.current = false; }, 200);
  }, [videoRef, safeSeek]);

  // Handle incoming seek from peer
  const handleRemoteSeek = useCallback(({ currentTime }) => {
    if (!videoRef.current) return;
    isSyncingRef.current = true;
    safeSeek(currentTime);
    setTimeout(() => { isSyncingRef.current = false; }, 200);
  }, [videoRef, safeSeek]);

  // Handle remote stop
  const handleRemoteStop = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  }, [videoRef]);

  // Handle remote speed change
  const handleRemoteSpeed = useCallback(({ speed }) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
  }, [videoRef]);

  // Check if a sync event was self-triggered (to avoid echo)
  const isSyncing = useCallback(() => isSyncingRef.current, []);

  return {
    emitPlay,
    emitPause,
    emitSeek,
    emitStop,
    emitSpeed,
    handleRemotePlay,
    handleRemotePause,
    handleRemoteSeek,
    handleRemoteStop,
    handleRemoteSpeed,
    isSyncing,
  };
};
