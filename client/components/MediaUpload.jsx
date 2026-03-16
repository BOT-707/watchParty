import { useRef, useState, useCallback } from 'react';

// Same MIME resolution as useFileStream — ensures VideoPlayer uses correct
// codec hint for both host (local file) and partner (streamed blob).
const resolveMimeType = (fileName, rawType) => {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const map = {
    mkv: 'video/webm', webm: 'video/webm',
    mp4: 'video/mp4',  m4v:  'video/mp4',  mov: 'video/mp4',
    avi: 'video/x-msvideo',
    ogg: 'video/ogg',  ogv:  'video/ogg',
    mp3: 'audio/mpeg', wav:  'audio/wav',  flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
  };
  return map[ext] || (rawType && rawType !== 'video/x-matroska' ? rawType : 'video/mp4');
};

const SUPPORTED_TYPES = [
  'video/mp4', 'video/webm', 'video/ogg', 'video/mkv', 'video/x-matroska',
  'video/avi', 'video/quicktime', 'video/x-msvideo',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/flac',
  'audio/aac', 'audio/webm',
];

const SUPPORTED_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.ogg', '.mp3', '.wav', '.flac', '.aac'];

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export default function MediaUpload({
  onMediaLoaded,
  socket,
  roomCode,
  partnerConnected = false,
  isStreaming = false,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [error, setError] = useState('');

  const processFile = useCallback((file) => {
    setError('');

    const isSupported =
      SUPPORTED_TYPES.includes(file.type) ||
      SUPPORTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isSupported) {
      setError(`Unsupported format. Try: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      return;
    }

    if (file.size > 8 * 1024 * 1024 * 1024) {
      setError('File too large. Maximum size is 8 GB.');
      return;
    }

    const url          = URL.createObjectURL(file);
    const resolvedType = resolveMimeType(file.name, file.type);
    setCurrentFile({ name: file.name, size: file.size, type: resolvedType });

    // Pass both URL and the raw File object — File is needed for P2P streaming
    // resolvedType ensures VideoPlayer initialises the correct audio decoder
    onMediaLoaded({ url, name: file.name, type: resolvedType, size: file.size, file });
  }, [onMediaLoaded]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const clearMedia = () => {
    setCurrentFile(null);
    setError('');
    onMediaLoaded(null);
  };

  // ── File loaded state ──────────────────────────────────────────
  if (currentFile) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        isStreaming
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-surface border-border'
      }`}>
        {/* File type icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${
          isStreaming
            ? 'bg-amber-500/20 border-amber-500/40'
            : 'bg-panel border-border'
        }`}>
          {currentFile.type?.startsWith('video') ? (
            <svg className={`w-4 h-4 ${isStreaming ? 'text-amber-400' : 'text-text-secondary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className={`w-4 h-4 ${isStreaming ? 'text-amber-400' : 'text-text-secondary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-medium text-text-primary truncate">{currentFile.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-text-muted font-mono">{formatFileSize(currentFile.size)}</span>
            {partnerConnected && (
              <span className={`flex items-center gap-1 text-xs font-mono ${isStreaming ? 'text-amber-400' : 'text-emerald-400'}`}>
                <span className={`w-1 h-1 rounded-full ${isStreaming ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                {isStreaming ? 'Streaming to partner…' : 'Streamed ✓'}
              </span>
            )}
            {!partnerConnected && (
              <span className="text-xs text-text-muted font-mono">Waiting for partner to join…</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isStreaming && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-panel border border-border text-text-secondary hover:text-text-primary hover:border-muted transition-colors font-display"
            >
              Change
            </button>
          )}
          <button
            onClick={clearMedia}
            disabled={isStreaming}
            className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Remove media"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept={SUPPORTED_EXTENSIONS.join(',')} onChange={handleFileChange} className="hidden" />
      </div>
    );
  }

  // ── Empty / drop target state ──────────────────────────────────
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-3 px-6 py-7 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
        isDragging
          ? 'border-amber-500 bg-amber-500/10 shadow-amber-glow'
          : 'border-border hover:border-muted hover:bg-surface/50 bg-surface'
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
        isDragging ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-panel border border-border'
      }`}>
        <svg className={`w-5 h-5 transition-colors ${isDragging ? 'text-amber-400' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>

      <div className="text-center">
        <p className={`text-sm font-display font-semibold ${isDragging ? 'text-amber-400' : 'text-text-primary'}`}>
          {isDragging ? 'Drop to load' : 'Upload Media'}
        </p>
        <p className="text-xs text-text-muted mt-0.5">Drag & drop or click to browse</p>
        {partnerConnected ? (
          <p className="text-xs text-emerald-400 mt-1 font-mono">
            ✓ Partner connected — file streams automatically
          </p>
        ) : (
          <p className="text-xs text-text-muted mt-1 font-mono">
            MP4 · WebM · MKV · AVI · MP3 · WAV
          </p>
        )}
      </div>

      {error && (
        <div className="absolute bottom-2 inset-x-2">
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-1.5 text-center">
            {error}
          </p>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept={SUPPORTED_EXTENSIONS.join(',')} onChange={handleFileChange} className="hidden" />
    </div>
  );
}
