/**
 * Socket.io Handler
 * Manages all real-time events:
 * - Room join/leave
 * - Playback synchronization (play/pause/seek/stop)
 * - Chat messages
 * - WebRTC signaling (offer/answer/ice-candidate)
 * - Media events
 * - Ping/latency
 */

const Room = require('../models/Room');
const { inMemoryRooms } = require('../controllers/roomController');

const roomState  = new Map();
const socketMeta = new Map();

const isMongoConnected = () => {
  const mongoose = require('mongoose');
  return mongoose.connection.readyState === 1;
};

const getActiveCount = (roomCode) => {
  const r = roomState.get(roomCode);
  if (!r) return 0;
  return (r.host.socketId ? 1 : 0) + (r.partner.socketId ? 1 : 0);
};

const getOtherSocket = (roomCode, myId) => {
  const r = roomState.get(roomCode);
  if (!r) return null;
  if (r.host.socketId    === myId) return r.partner.socketId;
  if (r.partner.socketId === myId) return r.host.socketId;
  return null;
};

const availableRole = (roomCode) => {
  const r = roomState.get(roomCode);
  if (!r)                  return 'host';
  if (!r.host.socketId)    return 'host';
  if (!r.partner.socketId) return 'partner';
  return null;
};

module.exports = (io) => {
  const IDLE_TIMEOUT = 30 * 60 * 1000;
  const idleTimers   = new Map();

  const resetIdle = (id) => {
    if (idleTimers.has(id)) clearTimeout(idleTimers.get(id));
    idleTimers.set(id, setTimeout(() => {
      const s = io.sockets.sockets.get(id);
      if (s) { s.emit('kicked', { reason: 'Inactivity timeout' }); s.disconnect(true); }
    }, IDLE_TIMEOUT));
  };

  const cleanupSocket = async (socketId) => {
    clearTimeout(idleTimers.get(socketId));
    idleTimers.delete(socketId);
    const meta = socketMeta.get(socketId);
    if (!meta) return;
    const { roomCode, role } = meta;
    socketMeta.delete(socketId);
    const r = roomState.get(roomCode);
    if (!r) return;
    if (role === 'host')    r.host.socketId    = null;
    if (role === 'partner') r.partner.socketId = null;
    const remaining = getActiveCount(roomCode);
    io.to(roomCode).emit('user-left', { socketId, role, userCount: remaining, timestamp: Date.now() });
    if (remaining === 0) {
      roomState.delete(roomCode);
      if (isMongoConnected()) {
        try { await Room.findOneAndUpdate({ code: roomCode }, { isActive: false }); } catch (_) {}
      } else {
        inMemoryRooms.delete(roomCode);
      }
    }
  };

  io.on('connection', (socket) => {
    resetIdle(socket.id);

    socket.on('join-room', async ({ roomCode }) => {
      try {
        if (!roomCode || roomCode.length !== 5)
          return socket.emit('error', { message: 'Invalid room code' });
        const prev = socketMeta.get(socket.id);
        if (prev && prev.roomCode !== roomCode) await cleanupSocket(socket.id);
        const role = availableRole(roomCode);
        if (!role) return socket.emit('error', { message: 'Room is full (max 2 users)' });
        if (!roomState.has(roomCode)) {
          roomState.set(roomCode, { host: { socketId: null }, partner: { socketId: null }, createdAt: Date.now() });
        }
        const r = roomState.get(roomCode);
        r[role].socketId = socket.id;
        socketMeta.set(socket.id, { roomCode, role });
        socket.join(roomCode);
        const userCount = getActiveCount(roomCode);
        if (isMongoConnected()) {
          try { await Room.findOneAndUpdate({ code: roomCode }, { $push: { users: { socketId: socket.id } }, lastActivity: new Date() }); } catch (_) {}
        }
        socket.emit('room-joined', { roomCode, socketId: socket.id, role, isHost: role === 'host', userCount, timestamp: Date.now() });
        const other = getOtherSocket(roomCode, socket.id);
        if (other) io.to(other).emit('user-joined', { socketId: socket.id, role, userCount, timestamp: Date.now() });
        resetIdle(socket.id);
      } catch (err) {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave-room', async () => { await cleanupSocket(socket.id); });

    socket.on('playback-play', ({ roomCode, currentTime, timestamp }) => {
      resetIdle(socket.id);
      socket.to(roomCode).emit('playback-play', { currentTime, timestamp: timestamp || Date.now(), fromSocketId: socket.id });
    });
    socket.on('playback-pause', ({ roomCode, currentTime, timestamp }) => {
      resetIdle(socket.id);
      socket.to(roomCode).emit('playback-pause', { currentTime, timestamp: timestamp || Date.now(), fromSocketId: socket.id });
    });
    socket.on('playback-seek', ({ roomCode, currentTime, timestamp }) => {
      resetIdle(socket.id);
      socket.to(roomCode).emit('playback-seek', { currentTime, timestamp: timestamp || Date.now(), fromSocketId: socket.id });
    });
    socket.on('playback-stop', ({ roomCode }) => {
      resetIdle(socket.id);
      socket.to(roomCode).emit('playback-stop', { fromSocketId: socket.id, timestamp: Date.now() });
    });
    socket.on('playback-speed', ({ roomCode, speed }) => {
      resetIdle(socket.id);
      socket.to(roomCode).emit('playback-speed', { speed, fromSocketId: socket.id });
    });
    socket.on('request-sync', ({ roomCode }) => {
      const other = getOtherSocket(roomCode, socket.id);
      if (other) io.to(other).emit('sync-state-request', { fromSocketId: socket.id, timestamp: Date.now() });
      else socket.emit('sync-state-response', { hasMedia: false });
    });
    socket.on('sync-state-response', ({ toSocketId, state }) => { io.to(toSocketId).emit('sync-state-response', state); });
    socket.on('media-loaded', ({ roomCode, mediaName, mediaType, duration }) => {
      resetIdle(socket.id);
      socket.to(roomCode).emit('media-loaded', { mediaName, mediaType, duration, fromSocketId: socket.id, timestamp: Date.now() });
    });
    socket.on('media-buffering', ({ roomCode, buffering }) => {
      socket.to(roomCode).emit('media-buffering', { buffering, fromSocketId: socket.id });
    });
    socket.on('chat-message', ({ roomCode, message, timestamp }) => {
      resetIdle(socket.id);
      if (!message?.trim() || message.length > 500) return;
      const meta = socketMeta.get(socket.id);
      io.to(roomCode).emit('chat-message', { id: `${socket.id}-${Date.now()}`, message: message.trim(), fromSocketId: socket.id, role: meta?.role || 'unknown', timestamp: timestamp || Date.now() });
    });
    socket.on('webrtc-offer', ({ roomCode, offer }) => {
      const t = getOtherSocket(roomCode, socket.id);
      if (t) io.to(t).emit('webrtc-offer', { offer, fromSocketId: socket.id });
    });
    socket.on('webrtc-answer', ({ roomCode, answer }) => {
      const t = getOtherSocket(roomCode, socket.id);
      if (t) io.to(t).emit('webrtc-answer', { answer, fromSocketId: socket.id });
    });
    socket.on('webrtc-ice-candidate', ({ roomCode, candidate }) => {
      const t = getOtherSocket(roomCode, socket.id);
      if (t) io.to(t).emit('webrtc-ice-candidate', { candidate, fromSocketId: socket.id });
    });
    socket.on('webrtc-call-ended', ({ roomCode }) => { socket.to(roomCode).emit('webrtc-call-ended', { fromSocketId: socket.id }); });
    socket.on('file-rtc-offer', ({ roomCode, offer }) => {
      const t = getOtherSocket(roomCode, socket.id);
      if (t) io.to(t).emit('file-rtc-offer', { offer, fromSocketId: socket.id });
    });
    socket.on('file-rtc-answer', ({ roomCode, answer }) => {
      const t = getOtherSocket(roomCode, socket.id);
      if (t) io.to(t).emit('file-rtc-answer', { answer, fromSocketId: socket.id });
    });
    socket.on('file-rtc-ice', ({ roomCode, candidate, role }) => {
      const t = getOtherSocket(roomCode, socket.id);
      if (t) io.to(t).emit('file-rtc-ice', { candidate, role, fromSocketId: socket.id });
    });
    socket.on('file-stream-available', ({ roomCode, fileName, fileSize, fileType }) => {
      socket.to(roomCode).emit('file-stream-available', { fileName, fileSize, fileType, fromSocketId: socket.id });
    });
    socket.on('ping', ({ timestamp }) => { socket.emit('pong', { timestamp, serverTimestamp: Date.now() }); });
    socket.on('disconnect', async (reason) => { await cleanupSocket(socket.id); });
    socket.on('error', (err) => console.error('Socket error:', err));
  });

  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of roomState) {
      if (!room.host.socketId && !room.partner.socketId && now - room.createdAt > 86400000) {
        roomState.delete(code); inMemoryRooms.delete(code);
      }
    }
  }, 5 * 60 * 1000);
};
