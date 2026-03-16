const Room = require('../models/Room');

// In-memory fallback when MongoDB is not available
const inMemoryRooms = new Map();

const isMongoConnected = () => {
  const mongoose = require('mongoose');
  return mongoose.connection.readyState === 1;
};

const generateCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

exports.createRoom = async (req, res) => {
  try {
    let code;
    let attempts = 0;

    if (isMongoConnected()) {
      // MongoDB mode
      let exists = true;
      while (exists && attempts < 10) {
        code = generateCode();
        exists = await Room.findOne({ code });
        attempts++;
      }
      if (attempts >= 10) {
        return res.status(500).json({ success: false, message: 'Could not generate unique room code' });
      }
      const room = new Room({ code });
      await room.save();
    } else {
      // In-memory fallback
      let exists = true;
      while (exists && attempts < 10) {
        code = generateCode();
        exists = inMemoryRooms.has(code);
        attempts++;
      }
      inMemoryRooms.set(code, {
        code,
        users: [],
        playbackState: { isPlaying: false, currentTime: 0, mediaName: '', mediaType: '' },
        createdAt: new Date(),
      });
    }

    res.json({ success: true, code });
  } catch (err) {
    console.error('createRoom error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.checkRoom = async (req, res) => {
  try {
    const { code } = req.params;

    if (isMongoConnected()) {
      const room = await Room.findOne({ code, isActive: true });
      if (!room) {
        return res.status(404).json({ success: false, message: 'Room not found' });
      }
      if (room.isFull()) {
        return res.status(403).json({ success: false, message: 'Room is full (max 2 users)' });
      }
      return res.json({
        success: true,
        room: {
          code: room.code,
          userCount: room.users.length,
          playbackState: room.playbackState,
        },
      });
    } else {
      // In-memory fallback
      const room = inMemoryRooms.get(code);
      if (!room) {
        return res.status(404).json({ success: false, message: 'Room not found' });
      }
      if (room.users.length >= 2) {
        return res.status(403).json({ success: false, message: 'Room is full (max 2 users)' });
      }
      return res.json({
        success: true,
        room: {
          code: room.code,
          userCount: room.users.length,
          playbackState: room.playbackState,
        },
      });
    }
  } catch (err) {
    console.error('checkRoom error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const { code } = req.params;

    if (isMongoConnected()) {
      const room = await Room.findOne({ code });
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      res.json({ success: true, room });
    } else {
      const room = inMemoryRooms.get(code);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      res.json({ success: true, room });
    }
  } catch (err) {
    console.error('getRoom error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export in-memory store for socket handler access
exports.inMemoryRooms = inMemoryRooms;
