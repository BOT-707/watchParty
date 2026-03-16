import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'

  const createRoom = async () => {
    setError('');
    setIsCreating(true);
    try {
      const res = await axios.post(`${SERVER_URL}/api/rooms/create`);
      if (res.data.success) {
        router.push(`/room/${res.data.code}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room. Is the server running?');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async (e) => {
    e?.preventDefault();
    if (!roomCode.trim()) return;
    setError('');
    setIsJoining(true);

    const code = roomCode.trim().toUpperCase().slice(0, 5);
    if (code.length !== 5) {
      setError('Room code must be exactly 5 characters.');
      setIsJoining(false);
      return;
    }

    try {
      const res = await axios.get(`${SERVER_URL}/api/rooms/check/${code}`);
      if (res.data.success) {
        router.push(`/room/${code}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || 'Room not found. Check the code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <>
      <Head>
        <title>WatchTogether — Watch Parties, Synchronized</title>
      </Head>

      <div className="min-h-screen bg-void flex flex-col relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(240,240,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(240,240,248,0.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="font-display font-bold text-lg text-text-primary tracking-tight">WatchTogether</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            WebRTC · Socket.io · Synchronized
          </div>
        </header>

        {/* Main */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {/* Hero */}
          <div className="text-center mb-12 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Real-time synchronized playback
            </div>
            <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-text-primary mb-4 leading-none tracking-tight">
              Watch
              <span className="text-amber-400 amber-text-glow"> Together</span>
            </h1>
            <p className="text-text-secondary text-lg md:text-xl max-w-md mx-auto font-body leading-relaxed">
              Create a private room, share the code, and watch any media in perfect sync with someone you care about.
            </p>
          </div>

          {/* Card */}
          <div className="w-full max-w-md animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-panel">
              {/* Tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => { setActiveTab('create'); setError(''); }}
                  className={`flex-1 py-4 text-sm font-display font-semibold transition-all relative ${
                    activeTab === 'create'
                      ? 'text-amber-400'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Create Room
                  {activeTab === 'create' && (
                    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-400" />
                  )}
                </button>
                <button
                  onClick={() => { setActiveTab('join'); setError(''); }}
                  className={`flex-1 py-4 text-sm font-display font-semibold transition-all relative ${
                    activeTab === 'join'
                      ? 'text-amber-400'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Join Room
                  {activeTab === 'join' && (
                    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-400" />
                  )}
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'create' ? (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h2 className="text-lg font-display font-semibold text-text-primary">Start a watch party</h2>
                      <p className="text-sm text-text-secondary">A unique 5-digit code will be generated for your room. Share it with your partner.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon: '🎬', label: 'Any format', sub: 'MP4, WebM, MKV…' },
                        { icon: '🔄', label: 'Synced', sub: 'Real-time sync' },
                        { icon: '🎥', label: 'Video call', sub: 'P2P via WebRTC' },
                      ].map((f) => (
                        <div key={f.label} className="bg-panel rounded-xl p-3 border border-border text-center">
                          <div className="text-xl mb-1">{f.icon}</div>
                          <p className="text-xs font-display font-medium text-text-primary">{f.label}</p>
                          <p className="text-[10px] text-text-muted font-mono">{f.sub}</p>
                        </div>
                      ))}
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                        <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm text-rose-400">{error}</p>
                      </div>
                    )}

                    <button
                      onClick={createRoom}
                      disabled={isCreating}
                      className="w-full py-3.5 rounded-xl btn-amber text-sm font-display font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isCreating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          Creating Room…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Create New Room
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={joinRoom} className="space-y-5">
                    <div className="space-y-1">
                      <h2 className="text-lg font-display font-semibold text-text-primary">Join an existing room</h2>
                      <p className="text-sm text-text-secondary">Enter the 5-digit room code shared by your partner.</p>
                    </div>

                    <div>
                      <label className="block text-xs text-text-muted font-mono mb-2">Room Code</label>
                      <input
                        type="text"
                        value={roomCode}
                        onChange={(e) => {
                          setError('');
                          setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5));
                        }}
                        placeholder="XXXXX"
                        maxLength={5}
                        autoFocus
                        className="w-full bg-panel border border-border rounded-xl px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] text-amber-400 outline-none focus:border-amber-500/60 transition-colors placeholder-text-muted"
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                        <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm text-rose-400">{error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isJoining || roomCode.length !== 5}
                      className="w-full py-3.5 rounded-xl btn-amber text-sm font-display font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isJoining ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          Joining…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          Join Room
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Note */}
            <p className="text-center text-xs text-text-muted mt-4 font-mono">
              No account needed · Max 2 users per room · Media stays on your device
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 py-6 text-center text-xs text-text-muted font-mono">
          WatchTogether · Built with Next.js, Socket.io & WebRTC
        </footer>
      </div>
    </>
  );
}
