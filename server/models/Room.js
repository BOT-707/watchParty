const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  socketId: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
});

const playbackStateSchema = new mongoose.Schema({
  isPlaying: { type: Boolean, default: false },
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  mediaName: { type: String, default: '' },
  mediaType: { type: String, default: '' },
  uploadedBy: { type: String, default: '' },
  loadedAt: { type: Date },
});

const roomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      length: 5,
      index: true,
    },
    users: {
      type: [userSchema],
      validate: {
        validator: function (arr) {
          return arr.length <= 2;
        },
        message: 'Room cannot have more than 2 users',
      },
    },
    playbackState: {
      type: playbackStateSchema,
      default: () => ({}),
    },
    isActive: { type: Boolean, default: true },
    lastActivity: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// TTL index: auto-delete rooms after 24 hours of inactivity
roomSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 });

// Methods
roomSchema.methods.isFull = function () {
  return this.users.length >= 2;
};

roomSchema.methods.addUser = function (socketId) {
  if (this.isFull()) throw new Error('Room is full');
  this.users.push({ socketId });
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.removeUser = function (socketId) {
  this.users = this.users.filter((u) => u.socketId !== socketId);
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.updatePlayback = function (state) {
  this.playbackState = { ...this.playbackState.toObject(), ...state };
  this.lastActivity = new Date();
  return this.save();
};

module.exports = mongoose.model('Room', roomSchema);
