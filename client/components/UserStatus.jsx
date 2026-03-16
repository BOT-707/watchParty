export default function UserStatus({
  mySocketId,
  myRole,
  partnerRole,
  userCount,
  partnerConnected,
  partnerSocketId,
  isBuffering,
  partnerBuffering,
  latency,
  roomCode,
  onCopyCode,
  copied,
}) {
  const getLatencyColor = (ms) => {
    if (!ms) return 'text-text-muted';
    if (ms < 50) return 'text-emerald-400';
    if (ms < 150) return 'text-amber-400';
    return 'text-rose-400';
  };
  const getLatencyLabel = (ms) => {
    if (!ms) return '—';
    if (ms < 50) return 'Excellent';
    if (ms < 150) return 'Good';
    return 'Poor';
  };
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Room code */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          <span className="text-sm font-display font-semibold text-text-primary">Room</span>
        </div>
        <button
          onClick={onCopyCode}
          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-panel border border-border hover:border-amber-500/40 transition-colors group"
        >
          <span className="font-mono text-base tracking-widest text-amber-400 font-semibold">{roomCode}</span>
          <div className="text-text-muted group-hover:text-amber-400 transition-colors">
            {copied ? (
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Users */}
      <div className="px-4 py-3 space-y-2.5">

        {/* Me */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-surface" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-display font-medium text-text-primary">You</span>
              {myRole && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  myRole === 'host'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                    : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                }`}>
                  {myRole}
                </span>
              )}
              <span className="text-xs text-emerald-400 font-mono">● Connected</span>
            </div>
            {mySocketId && (
              <p className="text-[10px] text-text-muted font-mono truncate">{mySocketId.slice(0, 12)}…</p>
            )}
          </div>
          {isBuffering && (
            <span className="flex items-center gap-1 text-xs text-amber-400 font-mono flex-shrink-0">
              <div className="flex gap-0.5">
                <span className="loading-dot w-1 h-1 rounded-full bg-amber-400" />
                <span className="loading-dot w-1 h-1 rounded-full bg-amber-400" />
                <span className="loading-dot w-1 h-1 rounded-full bg-amber-400" />
              </div>
              Buffering
            </span>
          )}
        </div>

        {/* Partner */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
              partnerConnected
                ? 'bg-cyan-500/20 border-cyan-500/40'
                : 'bg-panel border-border'
            }`}>
              <svg className={`w-4 h-4 ${partnerConnected ? 'text-cyan-400' : 'text-text-muted'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${
              partnerConnected ? 'bg-emerald-400' : 'bg-text-muted'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-display font-medium ${partnerConnected ? 'text-text-primary' : 'text-text-muted'}`}>
                {partnerRole ? partnerRole.charAt(0).toUpperCase() + partnerRole.slice(1) : 'Partner'}
              </span>
              {partnerRole && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  partnerRole === 'host'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                    : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                }`}>
                  {partnerRole}
                </span>
              )}
              <span className={`text-xs font-mono ${partnerConnected ? 'text-emerald-400' : 'text-text-muted'}`}>
                {partnerConnected ? '● Connected' : '○ Waiting…'}
              </span>
            </div>
            {partnerSocketId && (
              <p className="text-[10px] text-text-muted font-mono truncate">{partnerSocketId.slice(0, 12)}…</p>
            )}
          </div>
          {partnerBuffering && partnerConnected && (
            <span className="flex items-center gap-1 text-xs text-amber-400 font-mono flex-shrink-0">
              <div className="flex gap-0.5">
                <span className="loading-dot w-1 h-1 rounded-full bg-amber-400" />
                <span className="loading-dot w-1 h-1 rounded-full bg-amber-400" />
                <span className="loading-dot w-1 h-1 rounded-full bg-amber-400" />
              </div>
              Buffering
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-abyss border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-text-muted font-mono">{userCount || 1}/2 users</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className={`text-xs font-mono ${getLatencyColor(latency)}`}>
            {latency ? `${latency}ms` : '—'} {latency ? `· ${getLatencyLabel(latency)}` : ''}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${partnerConnected ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'}`} />
          <span className="text-xs text-text-muted font-mono">
            {partnerConnected ? 'Synced' : 'Solo'}
          </span>
        </div>
      </div>
    </div>
  );
}
