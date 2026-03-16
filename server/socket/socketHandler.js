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

// Track active socket rooms in memory for fast lookup
const socketRoomMap = new Map(); // socketId -> roomCode
const roomSocketsMap = new Map(); // roomCode -> Set<socketId>

const isMongoConnected = () => {
  const mongoose = require('mongoose');
  return mongoose.connection.readyState === 1;
};

const getRoomUsers = (roomCode) => {
  return roomSocketsMap.get(roomCode) || new Set();
};

const getOtherUser = (roomCode, mySocketId) => {
  const users = getRoomUsers(roomCode);
  for (const id of users) {
    if (id !== mySocketId) return id;
  }
  return null;
};

const getRoomUserCount = (roomCode) => {
  return getRoomUsers(roomCode).size;
};

module.exports = (io) => {
  // Inactivity timeout: disconnect users idle > 30 mins
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
  const inactivityTimers = new Map();

  const resetInactivityTimer = (socketId) => {
    if (inactivityTimers.has(socketId)) {
      clearTimeout(inactivityTimers.get(socketId));
    }
    const timer = setTimeout(() => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('kicked', { reason: 'Inactivity timeout' });
        socket.disconnect(true);
      }
    }, INACTIVITY_TIMEOUT);
    inactivityTimers.set(socketId, timer);
  };

  const cleanupSocket = async (socketId) => {
    clearTimeout(inactivityTimers.get(socketId));
    inactivityTimers.delete(socketId);

    const roomCode = socketRoomMap.get(socketId);
    if (!roomCode) return;

    socketRoomMap.delete(socketId);

    const users = roomSocketsMap.get(roomCode);
    if (users) {
      users.delete(socketId);
      if (users.size === 0) {
        roomSocketsMap.delete(roomCode);
        // Clean up room from DB/memory
        if (isMongoConnected()) {
          try {
            await Room.findOneAndUpdate(
              { code: roomCode },
              { isActive: false }
            );
          } catch (e) { /* ignore */ }
        } else {
          inMemoryRooms.delete(roomCode);
        }
      }
    }

    // Notify remaining users
    io.to(roomCode).emit('user-left', {
      socketId,
      userCount: getRoomUserCount(roomCode),
      timestamp: Date.now(),
    });
  };

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    resetInactivityTimer(socket.id);

    // ─── ROOM EVENTS ────────────────────────────────────────

    socket.on('join-room', async ({ roomCode }) => {
      try {
        if (!roomCode || roomCode.length !== 5) {
          return socket.emit('error', { message: 'Invalid room code' });
        }

        // Check if room exists and has space
        const currentUsers = getRoomUsers(roomCode);
        if (currentUsers.size >= 2) {
          return socket.emit('error', { message: 'Room is full (max 2 users)' });
        }

        // If already in a room, leave it first
        const existingRoom = socketRoomMap.get(socket.id);
        if (existingRoom && existingRoom !== roomCode) {
          await cleanupSocket(socket.id);
        }

        // Join the Socket.io room
        socket.join(roomCode);
        socketRoomMap.set(socket.id, roomCode);

        if (!roomSocketsMap.has(roomCode)) {
          roomSocketsMap.set(roomCode, new Set());
        }
        roomSocketsMap.get(roomCode).add(socket.id);

        const userCount = getRoomUserCount(roomCode);
        const isHost = userCount === 1;

        // Update DB
        if (isMongoConnected()) {
          try {
            await Room.findOneAndUpdate(
              { code: roomCode },
              {
                $push: { users: { socketId: socket.id } },
                lastActivity: new Date(),
              }
            );
          } catch (e) { /* ignore */ }
        }

        // Send room-joined to the joining user
        socket.emit('room-joined', {
          roomCode,
          socketId: socket.id,
          isHost,
          userCount,
          timestamp: Date.now(),
        });

        // Notify other user
        socket.to(roomCode).emit('user-joined', {
          socketId: socket.id,
          userCount,
          timestamp: Date.now(),
        });

        resetInactivityTimer(socket.id);
        console.log(`👥 ${socket.id} joined room ${roomCode} (${userCount}/2)`);
      } catch (err) {
        console.error('join-room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave-room', async () => {
      await cleanupSocket(socket.id);
    });

    // ─── PLAYBACK SYNC EVENTS ───────────────────────────────

    socket.on('playback-play', ({ roomCode, currentTime, timestamp }) => {
      resetInactivityTimer(socket.id);
      socket.to(roomCode).emit('playback-play', {
        currentTime,
        timestamp: timestamp || Date.now(),
        fromSocketId: socket.id,
      });
    });

    socket.on('playback-pause', ({ roomCode, currentTime, timestamp }) => {
      resetInactivityTimer(socket.id);
      socket.to(roomCode).emit('playback-pause', {
        currentTime,
        timestamp: timestamp || Date.now(),
        fromSocketId: socket.id,
      });
    });

    socket.on('playback-seek', ({ roomCode, currentTime, timestamp }) => {
      resetInactivityTimer(socket.id);
      socket.to(roomCode).emit('playback-seek', {
        currentTime,
        timestamp: timestamp || Date.now(),
        fromSocketId: socket.id,
      });
    });

    socket.on('playback-stop', ({ roomCode }) => {
      resetInactivityTimer(socket.id);
      socket.to(roomCode).emit('playback-stop', {
        fromSocketId: socket.id,
        timestamp: Date.now(),
      });
    });

    socket.on('playback-speed', ({ roomCode, speed }) => {
      resetInactivityTimer(socket.id);
      socket.to(roomCode).emit('playback-speed', { speed, fromSocketId: socket.id });
    });

    // Sync state request: new joiner asks for current playback state
    socket.on('request-sync', ({ roomCode }) => {
      const otherUser = getOtherUser(roomCode, socket.id);
      if (otherUser) {
        io.to(otherUser).emit('sync-state-request', {
          fromSocketId: socket.id,
          timestamp: Date.now(),
        });
      } else {
        socket.emit('sync-state-response', { hasMedia: false });
      }
    });

    // Response to sync request
    socket.on('sync-state-response', ({ toSocketId, state }) => {
      io.to(toSocketId).emit('sync-state-response', state);
    });

    // ─── MEDIA EVENTS ────────────────────────────────────────

    socket.on('media-loaded', ({ roomCode, mediaName, mediaType, duration }) => {
      resetInactivityTimer(socket.id);
      socket.to(roomCode).emit('media-loaded', {
        mediaName,
        mediaType,
        duration,
        fromSocketId: socket.id,
        timestamp: Date.now(),
      });
    });

    socket.on('media-buffering', ({ roomCode, buffering }) => {
      socket.to(roomCode).emit('media-buffering', {
        buffering,
        fromSocketId: socket.id,
      });
    });

    // ─── CHAT EVENTS ─────────────────────────────────────────

    socket.on('chat-message', ({ roomCode, message, timestamp }) => {
      resetInactivityTimer(socket.id);
      if (!message || message.trim().length === 0) return;
      if (message.length > 500) return; // Limit message length

      const chatData = {
        id: `${socket.id}-${Date.now()}`,
        message: message.trim(),
        fromSocketId: socket.id,
        timestamp: timestamp || Date.now(),
      };

      // Send to everyone in room including sender
      io.to(roomCode).emit('chat-message', chatData);
    });

    // ─── WEBRTC SIGNALING ────────────────────────────────────

    socket.on('webrtc-offer', ({ roomCode, offer, targetSocketId }) => {
      const target = targetSocketId || getOtherUser(roomCode, socket.id);
      if (target) {
        io.to(target).emit('webrtc-offer', {
          offer,
          fromSocketId: socket.id,
        });
      }
    });

    socket.on('webrtc-answer', ({ roomCode, answer, targetSocketId }) => {
      const target = targetSocketId || getOtherUser(roomCode, socket.id);
      if (target) {
        io.to(target).emit('webrtc-answer', {
          answer,
          fromSocketId: socket.id,
        });
      }
    });

    socket.on('webrtc-ice-candidate', ({ roomCode, candidate, targetSocketId }) => {
      const target = targetSocketId || getOtherUser(roomCode, socket.id);
      if (target) {
        io.to(target).emit('webrtc-ice-candidate', {
          candidate,
          fromSocketId: socket.id,
        });
      }
    });

    socket.on('webrtc-call-ended', ({ roomCode }) => {
      socket.to(roomCode).emit('webrtc-call-ended', {
        fromSocketId: socket.id,
      });
    });

    // ─── FILE STREAM SIGNALING (dedicated data-channel P2P) ─────────
    // These mirror the WebRTC call signaling but for the file transfer
    // peer connection which carries only a data channel (no audio/video).

    socket.on('file-rtc-offer', ({ roomCode, offer }) => {
      const target = getOtherUser(roomCode, socket.id);
      if (target) {
        io.to(target).emit('file-rtc-offer', { offer, fromSocketId: socket.id });
      }
    });

    socket.on('file-rtc-answer', ({ roomCode, answer }) => {
      const target = getOtherUser(roomCode, socket.id);
      if (target) {
        io.to(target).emit('file-rtc-answer', { answer, fromSocketId: socket.id });
      }
    });

    socket.on('file-rtc-ice', ({ roomCode, candidate, role }) => {
      const target = getOtherUser(roomCode, socket.id);
      if (target) {
        io.to(target).emit('file-rtc-ice', { candidate, role, fromSocketId: socket.id });
      }
    });

    // Notify partner that host has a file available for streaming
    socket.on('file-stream-available', ({ roomCode, fileName, fileSize, fileType }) => {
      socket.to(roomCode).emit('file-stream-available', {
        fileName,
        fileSize,
        fileType,
        fromSocketId: socket.id,
      });
    });

    // ─── PING / LATENCY ──────────────────────────────────────

    socket.on('ping', ({ timestamp }) => {
      socket.emit('pong', { timestamp, serverTimestamp: Date.now() });
    });

    // ─── DISCONNECT ──────────────────────────────────────────

    socket.on('disconnect', async (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
      await cleanupSocket(socket.id);
    });

    socket.on('error', (err) => {
      console.error(`Socket error for ${socket.id}:`, err);
    });
  });

  // Periodic cleanup: remove stale in-memory rooms every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of inMemoryRooms) {
      const age = now - new Date(room.createdAt).getTime();
      if (age > 86400000 && !roomSocketsMap.has(code)) { // > 24h and no active sockets
        inMemoryRooms.delete(code);
      }
    }
  }, 5 * 60 * 1000);
};
