const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatSpeed = (bytesPerMs) => {
  const bps = bytesPerMs * 1000;
  if (bps > 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
};

export default function StreamProgress({
  status,
  fileName,
  fileSize,
  sendProgress,
  recvProgress,
  onCancel,
  isPlayingLive = false, // true when partner has started watching a partial stream
}) {
  const progress = sendProgress || recvProgress;
  const isSending = sendProgress > 0 && recvProgress === 0;
  const isReceiving = recvProgress > 0;

  const truncateName = (name, maxLen = 36) =>
    name.length > maxLen ? `${name.slice(0, maxLen - 3)}…` : name;

  if (status === 'idle') return null;

  if (status === 'ready' && !isSending) return null; // Receiver: panel disappears once done

  const statusConfig = {
    offering: {
      label: 'Connecting to partner…',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      dotColor: 'bg-amber-400',
      animated: true,
    },
    sending: {
      label: `Streaming to partner · ${sendProgress}%`,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      dotColor: 'bg-amber-400',
      animated: true,
    },
    receiving: {
      label: isPlayingLive ? `▶ Playing live · ${recvProgress}% received` : `Receiving stream · ${recvProgress}%`,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      dotColor: 'bg-cyan-400',
      animated: true,
    },
    assembling: {
      label: 'Preparing video…',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      dotColor: 'bg-cyan-400',
      animated: true,
    },
    ready: {
      label: isSending ? 'Stream delivered ✓' : 'Ready to watch ✓',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      dotColor: 'bg-emerald-400',
      animated: false,
    },
    error: {
      label: 'Stream failed — try re-uploading',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
      dotColor: 'bg-rose-400',
      animated: false,
    },
    cancelled: {
      label: 'Stream cancelled',
      color: 'text-text-muted',
      bgColor: 'bg-panel',
      borderColor: 'border-border',
      dotColor: 'bg-text-muted',
      animated: false,
    },
  };

  const cfg = statusConfig[status] || statusConfig.idle;
  const transferredBytes = fileSize ? Math.round((progress / 100) * fileSize) : 0;

  return (
    <div className={`rounded-xl border px-4 py-3 ${cfg.bgColor} ${cfg.borderColor} transition-all`}>
      <div className="flex items-center gap-3">
        {/* Animated icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bgColor} border ${cfg.borderColor}`}>
          {status === 'sending' || status === 'offering' ? (
            <svg className={`w-4 h-4 ${cfg.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          ) : status === 'receiving' || status === 'assembling' ? (
            <svg className={`w-4 h-4 ${cfg.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          ) : status === 'ready' ? (
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className={`w-4 h-4 ${cfg.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotColor} ${cfg.animated ? 'animate-pulse' : ''}`} />
            <p className={`text-xs font-display font-semibold ${cfg.color}`}>{cfg.label}</p>
          </div>
          {fileName && (
            <p className="text-[11px] text-text-muted font-mono truncate">{truncateName(fileName)}</p>
          )}
        </div>

        {/* Cancel button */}
        {(status === 'sending' || status === 'receiving' || status === 'offering') && onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
            title="Cancel stream"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      {(status === 'sending' || status === 'receiving' || status === 'assembling') && (
        <div className="mt-3">
          <div className="relative w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
            {status === 'assembling' ? (
              <div
                className="absolute inset-y-0 left-0 bg-cyan-400 rounded-full"
                style={{
                  width: '40%',
                  animation: 'assembleSlide 1.2s ease-in-out infinite',
                }}
              />
            ) : (
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                  isSending ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
          {fileSize > 0 && status !== 'assembling' && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-text-muted font-mono">
                {formatBytes(transferredBytes)} / {formatBytes(fileSize)}
              </span>
              <span className={`text-[10px] font-mono font-semibold ${cfg.color}`}>
                {progress}%
              </span>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes assembleSlide {
          0% { left: -40%; width: 40%; }
          100% { left: 100%; width: 40%; }
        }
      `}</style>
    </div>
  );
}
