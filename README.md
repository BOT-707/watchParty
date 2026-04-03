# 🎬 WatchTogether — Synchronized Watch Party App

A full-stack real-time watch party application built with **Next.js**, **Node.js/Express**, **Socket.io**, **WebRTC**, and **MongoDB**. Watch any local media file in perfect sync with a remote partner — complete with P2P video/audio calls and live text chat.

"https://watch-party-mocha.vercel.app/"

---

## ✨ Features

| Category | Feature |
|---|---|
| **Rooms** | Generate/join rooms with unique 5-digit codes |
| **Sync** | Real-time play, pause, seek, stop, speed sync |
| **Media** | Upload MP4, WebM, MKV, AVI, MOV, MP3, WAV, FLAC |
| **Chat** | Real-time text chat with timestamps |
| **Calls** | P2P video call, audio-only call (WebRTC) |
| **Controls** | Mute, camera toggle, device selection |
| **UX** | Buffering indicators, latency display, sync status |
| **Player** | Custom HTML5 player — seekbar, volume, speed, fullscreen |
| **Safety** | Max 2 users/room, auto-disconnect idle users (30 min) |

---

## 🗂 Folder Structure

```
watch-party-app/
├── client/                     # Next.js frontend
│   ├── components/
│   │   ├── VideoPlayer.jsx     # Custom HTML5 media player
│   │   ├── ChatPanel.jsx       # Real-time text chat
│   │   ├── VideoCallPanel.jsx  # WebRTC P2P video/audio
│   │   ├── MediaUpload.jsx     # File upload with drag & drop
│   │   └── UserStatus.jsx      # Connection & sync status
│   ├── hooks/
│   │   ├── useSocket.js        # Socket.io connection manager
│   │   ├── useWebRTC.js        # WebRTC P2P calls
│   │   └── usePlaybackSync.js  # Playback sync with latency comp
│   ├── pages/
│   │   ├── index.js            # Home: create/join room
│   │   ├── room/[code].js      # Watch party room
│   │   └── 404.js
│   └── styles/
│       └── globals.css
├── server/                     # Node.js + Express backend
│   ├── controllers/
│   │   └── roomController.js   # Room CRUD logic
│   ├── models/
│   │   └── Room.js             # Mongoose schema
│   ├── routes/
│   │   └── roomRoutes.js       # REST API routes
│   ├── socket/
│   │   └── socketHandler.js    # All Socket.io event logic
│   └── index.js                # Server entry point
└── README.md
```

---

## ⚡ Prerequisites

- **Node.js** v18+ (v20 LTS recommended)
- **npm** v9+
- **MongoDB** v6+ (optional — app runs in-memory mode without it)

---

## 🚀 Quick Start (Local Development)

### 1. Clone / Extract the project

```bash
cd watch-party-app
```

### 2. Install all dependencies

```bash
# Install root, server, and client dependencies
npm run install:all

# Or manually:
npm install
cd server && npm install
cd ../client && npm install
```

### 3. Configure environment variables

**Server** (`server/.env`):
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/watchparty
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

**Client** (`client/.env.local`):
```env
NEXT_PUBLIC_SERVER_URL=http://localhost:5000
```

> **No MongoDB?** The server automatically falls back to in-memory storage. Rooms won't persist across server restarts, but everything else works fine.

### 4. Start development servers

**Option A — Run both together (requires `concurrently`):**
```bash
npm run dev
```

**Option B — Run separately:**
```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
cd client && npm run dev
```

### 5. Open the app

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health check: http://localhost:5000/health

---

## 🔄 How It Works

### Room Flow
1. User A visits `/`, clicks **Create Room** → server generates a 5-digit code and stores the room
2. User A shares the code with User B
3. User B enters the code and joins → Socket.io connects both users to the same room
4. Max 2 users per room — the 3rd person gets an error

### Media Streaming
- Media **never leaves the user's device** — `URL.createObjectURL()` creates a local blob URL
- Both users must upload their own copy of the same file
- The server only syncs playback *state* (play/pause/seek timestamps), not the file itself

### Playback Sync
- Events: `playback-play`, `playback-pause`, `playback-seek`, `playback-stop`, `playback-speed`
- Latency compensation: timestamps are embedded in each event; the receiver adjusts `currentTime` by `(now - sentAt) / 1000` seconds
- Drift correction: if playback positions differ by >0.5s, the receiver hard-seeks to match

### WebRTC (P2P Calls)
- ICE servers: Google STUN servers (no TURN = may fail on some NAT configs)
- Signaling via Socket.io: `webrtc-offer` → `webrtc-answer` → `webrtc-ice-candidate`
- Supports video + audio call, or audio-only
- Per-call mute/camera-off controls
- Device selection (camera/microphone)

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `POST` | `/api/rooms/create` | Create a new room, returns `{ code }` |
| `GET` | `/api/rooms/check/:code` | Check if room exists and has space |
| `GET` | `/api/rooms/:code` | Get room details |

---

## 🔌 Socket.io Events

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomCode }` | Join a room |
| `leave-room` | — | Leave current room |
| `playback-play` | `{ roomCode, currentTime, timestamp }` | Emit play |
| `playback-pause` | `{ roomCode, currentTime, timestamp }` | Emit pause |
| `playback-seek` | `{ roomCode, currentTime, timestamp }` | Emit seek |
| `playback-stop` | `{ roomCode }` | Emit stop |
| `playback-speed` | `{ roomCode, speed }` | Change playback speed |
| `request-sync` | `{ roomCode }` | Ask peer for current playback state |
| `sync-state-response` | `{ toSocketId, state }` | Send state to requesting peer |
| `media-loaded` | `{ roomCode, mediaName, mediaType }` | Notify peer of loaded media |
| `media-buffering` | `{ roomCode, buffering }` | Notify peer of buffer state |
| `chat-message` | `{ roomCode, message, timestamp }` | Send chat message |
| `webrtc-offer` | `{ roomCode, offer }` | WebRTC offer |
| `webrtc-answer` | `{ roomCode, answer }` | WebRTC answer |
| `webrtc-ice-candidate` | `{ roomCode, candidate }` | ICE candidate |
| `webrtc-call-ended` | `{ roomCode }` | End call |
| `ping` | `{ timestamp }` | Latency ping |

### Server → Client
| Event | Description |
|---|---|
| `room-joined` | Confirmation with `socketId`, `isHost`, `userCount` |
| `user-joined` | Another user joined with their `socketId` |
| `user-left` | Partner disconnected |
| `playback-*` | Forwarded playback events from peer |
| `chat-message` | Forwarded chat message |
| `sync-state-request` | Peer asking for your playback state |
| `media-loaded` | Partner loaded media |
| `media-buffering` | Partner buffering state |
| `webrtc-offer/answer/ice-candidate` | Forwarded WebRTC signaling |
| `webrtc-call-ended` | Partner ended the call |
| `error` | Error message |
| `kicked` | Disconnected (e.g., inactivity) |
| `pong` | Latency response |

---

## 🏗 Production Deployment

### Docker (Recommended)

Create `docker-compose.yml` at the root:

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"

  server:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - MONGO_URI=mongodb://mongodb:27017/watchparty
      - CLIENT_URL=https://your-frontend-domain.com
      - NODE_ENV=production
    depends_on:
      - mongodb

  client:
    build: ./client
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SERVER_URL=https://your-backend-domain.com
    depends_on:
      - server

volumes:
  mongo-data:
```

Add Dockerfiles:

**`server/Dockerfile`:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]
```

**`client/Dockerfile`:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker-compose up -d
```

---

### Manual VPS Deployment (e.g., Ubuntu + Nginx)

#### Backend
```bash
cd server
npm ci --only=production
# Use PM2 for process management
npm install -g pm2
pm2 start index.js --name watch-party-server
pm2 save && pm2 startup
```

#### Frontend
```bash
cd client
npm ci
NEXT_PUBLIC_SERVER_URL=https://api.yourdomain.com npm run build
npm install -g pm2
pm2 start npm --name watch-party-client -- start
```

#### Nginx config
```nginx
# Backend (WebSocket support required!)
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

### Deploy to Vercel + Railway (Free Tier)

**Backend → Railway:**
1. Push `/server` to a GitHub repo (or subdirectory)
2. Create a Railway project, connect the repo
3. Add environment variables: `MONGO_URI` (use Railway's MongoDB plugin), `CLIENT_URL`
4. Railway auto-detects Node.js and deploys

**Frontend → Vercel:**
1. Push `/client` to GitHub
2. Import in Vercel, set root directory to `client`
3. Add env var: `NEXT_PUBLIC_SERVER_URL=https://your-railway-url.up.railway.app`
4. Deploy

> ⚠️ **WebRTC Note:** For production, you may need a TURN server (e.g., Twilio TURN, Metered.ca) if users are behind strict NAT/firewalls. Add TURN credentials to `ICE_SERVERS` in `client/hooks/useWebRTC.js`.

---

## 🎮 Keyboard Shortcuts (Video Player)

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `→` | Seek +5 seconds |
| `←` | Seek -5 seconds |
| `↑` | Volume +10% |
| `↓` | Volume -10% |

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| "Room not found" on create | Is the server running? Check `http://localhost:5000/health` |
| Video out of sync | Reload both clients; the joining user will request a fresh sync |
| WebRTC call won't connect | Try on same network first; for different networks, add a TURN server |
| MongoDB connection error | Server falls back to in-memory — rooms won't persist restarts, but playback sync still works |
| MKV not playing | Chrome doesn't support MKV natively. Convert to MP4/WebM, or use Firefox |
| Can't hear audio in call | Check browser permissions for microphone access |

---

## 🛡 Security Notes

- No authentication — rooms are protected only by the 5-digit code
- For production, consider adding rate limiting (`express-rate-limit`) to prevent room flooding
- Media files are processed locally (object URLs) — no file data is sent to the server
- Socket connections are validated per-room; room code + socket ID must match

---

## 📝 License

MIT — free to use and modify.
