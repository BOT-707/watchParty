import { useRef, useState, useEffect, useCallback } from 'react';
import { usePlaybackSync } from '../hooks/usePlaybackSync';

const formatTime = (s) => {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ mediaUrl, mediaType, socket, roomCode, isHost, onBuffering }) {
  const videoRef       = useRef(null);
  const containerRef   = useRef(null);
  const controlsTimer  = useRef(null);
  const progressRef    = useRef(null);

  const [isPlaying,       setIsPlaying]       = useState(false);
  const [currentTime,     setCurrentTime]     = useState(0);
  const [duration,        setDuration]        = useState(0);
  const [volume,          setVolume]          = useState(1);
  const [isMuted,         setIsMuted]         = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [showControls,    setShowControls]    = useState(true);
  const [playbackSpeed,   setPlaybackSpeed]   = useState(1);
  const [isBuffering,     setIsBuffering]     = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [showSpeedMenu,   setShowSpeedMenu]   = useState(false);
  const [isDragging,      setIsDragging]      = useState(false);
  const [showVolSlider,   setShowVolSlider]   = useState(false);

  const { emitPlay, emitPause, emitSeek, emitStop, emitSpeed,
          handleRemotePlay, handleRemotePause, handleRemoteSeek,
          handleRemoteStop, handleRemoteSpeed, isSyncing } =
    usePlaybackSync({ socket, roomCode, videoRef, isHost });

  // ── Socket listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.on('playback-play',  handleRemotePlay);
    socket.on('playback-pause', handleRemotePause);
    socket.on('playback-seek',  handleRemoteSeek);
    socket.on('playback-stop',  handleRemoteStop);
    socket.on('playback-speed', handleRemoteSpeed);
    socket.on('sync-state-request', ({ fromSocketId }) => {
      if (!videoRef.current) return;
      socket.emit('sync-state-response', {
        toSocketId: fromSocketId,
        state: {
          isPlaying:    !videoRef.current.paused,
          currentTime:  videoRef.current.currentTime,
          hasMedia:     !!mediaUrl,
          playbackRate: videoRef.current.playbackRate,
        },
      });
    });
    return () => {
      socket.off('playback-play',  handleRemotePlay);
      socket.off('playback-pause', handleRemotePause);
      socket.off('playback-seek',  handleRemoteSeek);
      socket.off('playback-stop',  handleRemoteStop);
      socket.off('playback-speed', handleRemoteSpeed);
      socket.off('sync-state-request');
    };
  }, [socket, handleRemotePlay, handleRemotePause, handleRemoteSeek, handleRemoteStop, handleRemoteSpeed, mediaUrl]);

  useEffect(() => {
    if (!socket) return;
    socket.on('sync-state-response', ({ isPlaying, currentTime, hasMedia, playbackRate }) => {
      if (!videoRef.current || !hasMedia) return;
      if (currentTime) videoRef.current.currentTime = currentTime;
      if (playbackRate) videoRef.current.playbackRate = playbackRate;
      if (isPlaying) videoRef.current.play().catch(() => {});
    });
    return () => socket.off('sync-state-response');
  }, [socket]);

  // ── Video native events ───────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime   = () => {
      if (!isDragging) setCurrentTime(v.currentTime);
      if (v.buffered.length > 0 && isFinite(v.duration) && v.duration > 0) {
        setBufferedPercent((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
      }
    };
    const onDur    = () => setDuration(v.duration);
    const onPlay   = () => setIsPlaying(true);
    const onPause  = () => setIsPlaying(false);
    const onWait   = () => { setIsBuffering(true);  onBuffering?.(true);  };
    const onCan    = () => { setIsBuffering(false); onBuffering?.(false); };
    const onVol    = () => { setVolume(v.volume); setIsMuted(v.muted); };
    const onEnd    = () => { setIsPlaying(false); if (!isSyncing()) emitStop(); };
    const onFs     = () => setIsFullscreen(!!document.fullscreenElement);

    v.addEventListener('timeupdate',     onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('play',           onPlay);
    v.addEventListener('pause',          onPause);
    v.addEventListener('waiting',        onWait);
    v.addEventListener('canplay',        onCan);
    v.addEventListener('volumechange',   onVol);
    v.addEventListener('ended',          onEnd);
    document.addEventListener('fullscreenchange', onFs);

    return () => {
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('waiting',        onWait);
      v.removeEventListener('canplay',        onCan);
      v.removeEventListener('volumechange',   onVol);
      v.removeEventListener('ended',          onEnd);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [isDragging, emitStop, isSyncing, onBuffering]);

  // ── Auto-hide controls ────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    if (isPlaying) controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
    return () => clearTimeout(controlsTimer.current);
  }, [isPlaying]);

  // ── Controls ──────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !mediaUrl) return;
    if (v.paused) v.play().then(() => { if (!isSyncing()) emitPlay(v.currentTime); }).catch(console.error);
    else          { v.pause(); if (!isSyncing()) emitPause(v.currentTime); }
  }, [mediaUrl, isSyncing, emitPlay, emitPause]);

  const handleSeek = useCallback((e) => {
    const v = videoRef.current;
    if (!v || !duration || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1)) * duration;
    v.currentTime = t;
    setCurrentTime(t);
    if (!isSyncing()) emitSeek(t);
  }, [duration, isSyncing, emitSeek]);

  const handleVolume = useCallback((e) => {
    const v = videoRef.current;
    if (!v) return;
    const vol = parseFloat(e.target.value);
    v.volume = vol;
    v.muted  = vol === 0;
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
  }, []);

  const handleSpeed = useCallback((speed) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (!isSyncing()) emitSpeed(speed);
  }, [isSyncing, emitSpeed]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen?.();
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const v = videoRef.current;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': if (v) { const t = Math.min(v.currentTime+5, duration); v.currentTime=t; emitSeek(t); } break;
        case 'ArrowLeft':  if (v) { const t = Math.max(v.currentTime-5, 0);         v.currentTime=t; emitSeek(t); } break;
        case 'ArrowUp':    if (v) v.volume = Math.min(v.volume + 0.1, 1); break;
        case 'ArrowDown':  if (v) v.volume = Math.max(v.volume - 0.1, 0); break;
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, toggleFullscreen, toggleMute, duration, emitSeek]);

  const pct      = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isAudio  = mediaType?.startsWith('audio');
  const volVal   = isMuted ? 0 : volume;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-void rounded-xl overflow-hidden group"
      style={{ aspectRatio: isAudio ? 'unset' : '16/9' }}
      onMouseMove={resetTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={(e) => { if (e.target === containerRef.current || e.target === videoRef.current) togglePlay(); }}
    >
      {/* Media element */}
      {mediaUrl ? (
        isAudio ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 bg-gradient-to-br from-surface to-abyss">
            <div className="w-24 h-24 rounded-full bg-panel border border-border flex items-center justify-center mb-6 relative">
              <div className={`absolute inset-0 rounded-full border-2 border-amber-400 ${isPlaying ? 'animate-ping opacity-30' : 'opacity-0'}`} />
              <svg className="w-12 h-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            </div>
            <audio ref={videoRef} src={mediaUrl} preload="auto" className="hidden" />
          </div>
        ) : (
          <video ref={videoRef} src={mediaUrl} className="w-full h-full object-contain" preload="auto" playsInline />
        )
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[240px] bg-gradient-to-br from-surface to-abyss">
          <div className="w-20 h-20 rounded-full bg-panel border border-border flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-text-muted text-sm">Upload media to start watching</p>
        </div>
      )}

      {/* Buffering spinner */}
      {isBuffering && mediaUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="flex items-center gap-2 bg-panel/90 backdrop-blur-sm px-4 py-2 rounded-full border border-border">
            <div className="flex gap-1">
              <div className="loading-dot w-2 h-2 rounded-full bg-amber-400" />
              <div className="loading-dot w-2 h-2 rounded-full bg-amber-400" />
              <div className="loading-dot w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <span className="text-xs text-text-secondary font-mono">Buffering</span>
          </div>
        </div>
      )}

      {/* Controls */}
      {mediaUrl && (
        <div className={`absolute inset-x-0 bottom-0 transition-all duration-300 ${showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
          <div className="relative px-4 pb-3 pt-8">

            {/* Seek bar */}
            <div
              ref={progressRef}
              className="relative w-full h-1 bg-muted rounded-full cursor-pointer group/p mb-3 hover:h-1.5 transition-all"
              onClick={handleSeek}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseMove={(e) => isDragging && handleSeek(e)}
            >
              <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{ width: `${bufferedPercent}%` }} />
              <div className="absolute inset-y-0 left-0 bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-400 rounded-full opacity-0 group-hover/p:opacity-100 transition-opacity" style={{ left: `calc(${pct}% - 6px)` }} />
            </div>

            {/* Button row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {/* Play/Pause */}
                <button onClick={togglePlay} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                  {isPlaying
                    ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                    : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                </button>

                {/* Stop */}
                <button onClick={() => { const v=videoRef.current; if(v){v.pause();v.currentTime=0;emitStop();} }} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                </button>

                {/* Volume */}
                <div className="relative flex items-center" onMouseEnter={() => setShowVolSlider(true)} onMouseLeave={() => setShowVolSlider(false)}>
                  <button onClick={toggleMute} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                    {volVal === 0
                      ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                      : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>}
                  </button>
                  {showVolSlider && (
                    <div className="absolute left-full ml-1 bg-panel border border-border rounded-lg px-3 py-2 flex items-center">
                      <input type="range" min="0" max="1" step="0.05" value={volVal} onChange={handleVolume}
                        className="w-20"
                        style={{ background: `linear-gradient(to right,#f59e0b ${volVal*100}%,#2e2e45 ${volVal*100}%)` }}
                      />
                    </div>
                  )}
                </div>

                {/* Time */}
                <span className="text-xs text-white/80 font-mono ml-1">{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>

              <div className="flex items-center gap-1">
                {/* Speed */}
                <div className="relative">
                  <button onClick={() => setShowSpeedMenu(v => !v)} className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs text-white/80 font-mono transition-colors">
                    {playbackSpeed}×
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-1 bg-panel border border-border rounded-lg overflow-hidden shadow-panel z-10">
                      {SPEEDS.map(s => (
                        <button key={s} onClick={() => handleSpeed(s)}
                          className={`block w-full px-4 py-1.5 text-xs text-left hover:bg-muted transition-colors font-mono ${s===playbackSpeed?'text-amber-400':'text-text-secondary'}`}>
                          {s}×
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                  {isFullscreen
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"/></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
