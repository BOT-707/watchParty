const express = require('express');
const router = express.Router();
const { createRoom, checkRoom, getRoom } = require('../controllers/roomController');

// POST /api/rooms/create — create a new room
router.post('/create', createRoom);

// GET /api/rooms/check/:code — check if room exists & has space
router.get('/check/:code', checkRoom);

// GET /api/rooms/:code — get room details
router.get('/:code', getRoom);

module.exports = router;
