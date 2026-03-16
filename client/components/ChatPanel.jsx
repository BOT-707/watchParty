import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

export default function ChatPanel({ socket, roomCode, mySocketId, partnerConnected }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data) => {
      setMessages((prev) => [...prev, { ...data, isOwn: data.fromSocketId === mySocketId }]);
    };

    const handleUserJoined = ({ socketId }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          type: 'system',
          message: 'Your watch partner joined the room 🎬',
          timestamp: Date.now(),
        },
      ]);
    };

    const handleUserLeft = () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          type: 'system',
          message: 'Your watch partner left the room',
          timestamp: Date.now(),
        },
      ]);
    };

    socket.on('chat-message', handleMessage);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('chat-message', handleMessage);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, mySocketId]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || !socket) return;
    socket.emit('chat-message', {
      roomCode,
      message: input.trim(),
      timestamp: Date.now(),
    });
    setInput('');
    inputRef.current?.focus();
  }, [input, socket, roomCode]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-display font-semibold text-text-primary">Chat</span>
        </div>
        <span className="text-xs text-text-muted font-mono">{messages.filter(m => m.type !== 'system').length} msgs</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-panel border border-border flex items-center justify-center">
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-text-muted text-xs text-center">No messages yet.<br />Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-xs text-text-muted bg-panel px-3 py-1 rounded-full border border-border">
                    {msg.message}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col message-enter ${msg.isOwn ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.isOwn
                      ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30 rounded-tr-sm'
                      : 'bg-panel text-text-primary border border-border rounded-tl-sm'
                  }`}
                >
                  {msg.message}
                </div>
                <span className="text-[10px] text-text-muted mt-1 px-1 font-mono">
                  {format(new Date(msg.timestamp), 'HH:mm')}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border">
        <div className={`flex items-center gap-2 bg-panel rounded-xl px-3 py-2 border transition-colors ${
          input ? 'border-amber-500/40' : 'border-border'
        }`}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={partnerConnected ? 'Type a message…' : 'Waiting for partner…'}
            disabled={!partnerConnected}
            maxLength={500}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none disabled:opacity-40 font-body"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !partnerConnected}
            className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1 text-right font-mono">{input.length}/500</p>
      </div>
    </div>
  );
}
