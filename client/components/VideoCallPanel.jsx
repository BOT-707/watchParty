import { useEffect, useRef, useState } from 'react';

export default function VideoCallPanel({
  localStream,
  remoteStream,
  isCallActive,
  isMuted,
  isCameraOff,
  callStatus,
  availableDevices,
  selectedCamera,
  selectedMic,
  setSelectedCamera,
  setSelectedMic,
  onStartCall,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  partnerConnected,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (isMinimized) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isCallActive ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'}`} />
          <span className="text-sm font-display text-text-secondary">
            {isCallActive ? 'Call active' : 'Video Call'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isCallActive && (
            <>
              <button onClick={onToggleMute} className={`p-1.5 rounded-lg transition-colors ${isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-panel text-text-secondary hover:text-text-primary'}`}>
                <MicIcon muted={isMuted} size={14} />
              </button>
              <button onClick={onToggleCamera} className={`p-1.5 rounded-lg transition-colors ${isCameraOff ? 'bg-rose-500/20 text-rose-400' : 'bg-panel text-text-secondary hover:text-text-primary'}`}>
                <CameraIcon off={isCameraOff} size={14} />
              </button>
              <button onClick={onEndCall} className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors">
                <PhoneOffIcon size={14} />
              </button>
            </>
          )}
          <button onClick={() => setIsMinimized(false)} className="p-1.5 rounded-lg bg-panel text-text-secondary hover:text-text-primary transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-display font-semibold text-text-primary">Video Call</span>
          {isCallActive && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-panel transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-panel transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Device settings */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-border bg-abyss space-y-2">
          <div>
            <label className="text-xs text-text-muted mb-1 block font-mono">Camera</label>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full text-xs bg-panel border border-border rounded-lg px-2 py-1.5 text-text-secondary outline-none"
            >
              {availableDevices.cameras.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block font-mono">Microphone</label>
            <select
              value={selectedMic}
              onChange={(e) => setSelectedMic(e.target.value)}
              className="w-full text-xs bg-panel border border-border rounded-lg px-2 py-1.5 text-text-secondary outline-none"
            >
              {availableDevices.microphones.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Video feeds */}
      <div className="relative bg-abyss">
        {/* Remote video (main) */}
        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
          {remoteStream && isCallActive ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-panel border border-border flex items-center justify-center">
                  <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-xs text-text-muted">
                  {isCallActive ? 'No video from partner' : 'Partner not in call'}
                </span>
              </div>
            </div>
          )}

          {/* Local video (picture-in-picture) */}
          {localStream && (
            <div className="absolute bottom-2 right-2 w-20 rounded-lg overflow-hidden border border-border shadow-panel">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full object-cover ${isCameraOff ? 'invisible' : ''}`}
                style={{ aspectRatio: '4/3' }}
              />
              {isCameraOff && (
                <div className="absolute inset-0 bg-panel flex items-center justify-center">
                  <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-3">
        {!isCallActive ? (
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => onStartCall(true)}
              disabled={!partnerConnected || callStatus === 'calling'}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-display font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {callStatus === 'calling' ? 'Calling…' : 'Video Call'}
            </button>
            <button
              onClick={() => onStartCall(false)}
              disabled={!partnerConnected || callStatus === 'calling'}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-display font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Audio Only
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full">
            <button
              onClick={onToggleMute}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-display font-medium transition-colors border ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-panel text-text-secondary border-border hover:text-text-primary'
              }`}
            >
              <MicIcon muted={isMuted} size={16} />
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={onToggleCamera}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-display font-medium transition-colors border ${
                isCameraOff
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-panel text-text-secondary border-border hover:text-text-primary'
              }`}
            >
              <CameraIcon off={isCameraOff} size={16} />
              {isCameraOff ? 'Show Cam' : 'Hide Cam'}
            </button>
            <button
              onClick={onEndCall}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-colors text-sm font-display font-medium"
            >
              <PhoneOffIcon size={16} />
              End
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Icon sub-components
function MicIcon({ muted, size = 16 }) {
  return muted ? (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
  ) : (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function CameraIcon({ off, size = 16 }) {
  return off ? (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
  ) : (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function PhoneOffIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
    </svg>
  );
}
