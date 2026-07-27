# SyncWave - Multi-Device Synchronized Music Player (MVP)

A real-time room application for synchronized music playback across devices. This MVP implements only the room/device synchronization layer - no audio playback yet.

## Project Structure

```
syncwave/
├── client/                 # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── components/     # Reusable components (UserList)
│   │   ├── pages/          # Page components (Home, Room)
│   │   ├── socket.js       # Socket.IO client configuration
│   │   ├── App.jsx         # Routing
│   │   └── main.jsx        # Entry point
│   ├── package.json
│   ├── vite.config.js      # Configured for LAN access (--host)
│   └── tailwind.config.js
├── server/                 # Node.js + Express + Socket.IO backend
│   ├── server.js           # All server logic in one file
│   └── package.json
└── README.md
```

## Quick Start

### 1. Install Backend Dependencies

```bash
cd server
npm install
```

### 2. Install Frontend Dependencies

```bash
cd client
npm install
```

### 3. Start Backend Server

```bash
cd server
npm run dev
# or: npm start
```

Server runs on **port 3000**, listening on all interfaces (`0.0.0.0`).
Output:
```
Server running on port 3000
Access from LAN: http://<your-laptop-ip>:3000
```

### 4. Start Frontend (with LAN access)

```bash
cd client
npm run dev
```

Vite runs on **port 5173**, accessible from LAN via `--host` flag.
Output:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/   ← Use this IP on your phone
```

### 5. Find Your Laptop's Local IP

**Linux/macOS:**
```bash
hostname -I
# or
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```cmd
ipconfig
```
Look for `IPv4 Address` under your Wi-Fi adapter (e.g., `192.168.1.42`).

### 6. Test from Phone

1. Connect phone to **same Wi-Fi** as laptop
2. Open browser on phone
3. Go to: `http://<your-laptop-ip>:5173`
   - Example: `http://192.168.1.42:5173`

> ⚠️ **Important:** On your phone, `localhost` means **the phone itself**, not your laptop. You MUST use the laptop's LAN IP address.

## How to Test the Complete Flow

1. **Laptop**: Open `http://localhost:5173`
2. **Laptop**: Enter name "Jenil" → Click **Create Room**
3. **Laptop**: Note the room code (e.g., `K7P2QA`)
4. **Phone**: Open `http://<laptop-ip>:5173`
5. **Phone**: Enter name "Raj" → Enter room code `K7P2QA` → Click **Join Room**
6. **Both devices** should instantly show:
   ```
   Connected Devices: 2
   👑 Jenil — Host
   Raj
   ```
7. **Phone**: Close browser tab
8. **Laptop** should instantly update to:
   ```
   Connected Devices: 1
   👑 Jenil — Host
   ```

## Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `create-room` | `{ name: string }` | Create new room, become host |
| `join-room` | `{ name: string, roomCode: string }` | Join existing room |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `room-created` | `{ roomCode, users[] }` | Room created successfully |
| `room-joined` | `{ roomCode, users[] }` | Joined room successfully |
| `room-users` | `{ users[], roomCode }` | Broadcast: user list updated |
| `room-error` | `{ message }` | Error (room not found, name taken, etc.) |

### Socket.IO Concepts Used

- **`socket.id`**: Unique ID for each connected socket (browser tab/device)
- **`socket.join(roomCode)`**: Adds socket to a server-side "room" (string name)
- **`socket.emit()`**: Send to **only this socket**
- **`io.to(room).emit()`**: Send to **all sockets in room** (including sender)
- **`socket.to(room).emit()`**: Send to **all sockets in room EXCEPT sender**
- **`socket.on('disconnect')`**: Fires when tab closes, refreshes, or network drops

## Room Data Structure (In-Memory)

```js
const rooms = new Map(); // roomCode -> Room

// Room object:
{
  roomCode: "A7K2PQ",
  host: "socket-id-of-creator",
  users: [
    { socketId: "socket-id", name: "Jenil", isHost: true },
    { socketId: "socket-id", name: "Raj", isHost: false }
  ]
}
```

## Key Implementation Details

- **Server is authoritative**: Frontend never decides room existence, host status, or user list
- **Room codes**: 6-char uppercase alphanumeric, generated server-side, case-insensitive on join
- **Host transfer**: If host disconnects, first remaining user becomes host
- **Empty room cleanup**: Rooms deleted when last user leaves
- **No database**: All state in memory (Map) - resets on server restart

## Configuration

### Backend (server.js)
- Port: `3000` (env `PORT`)
- CORS: Allows all origins (`*`) for development
- Listens on: `0.0.0.0` (all network interfaces)

### Frontend (vite.config.js)
```js
server: {
  host: '0.0.0.0',  // Listen on LAN
  port: 5173,
  strictPort: true
}
```

### Socket URL (client/src/socket.js)
Defaults to `http://localhost:3000`. Override with:
```bash
VITE_SOCKET_URL=http://192.168.1.42:3000 npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6 |
| Realtime | Socket.IO Client 4 |
| Backend | Node.js, Express 4, Socket.IO 4 |
| Language | ES Modules (type: "module") |

## What's NOT Implemented (Future)

- Audio playback / synchronization
- WebRTC for peer-to-peer audio
- Database (Redis, PostgreSQL)
- Authentication / user accounts
- Playlists, queue, search
- Spotify/Apple Music integration
- Background playback on mobile

## License

MIT - Built for learning/experimentation
