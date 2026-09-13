import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use('/audio', express.static(fileURLToPath(new URL('./public/audio', import.meta.url))));

app.get('/api/songs', (req, res) => {
  res.json(Object.values(TRACKS));
});

const server = http.createServer(app);

// Socket.IO server with CORS for development (allow all origins)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory room storage
// Map<roomCode, Room>
const rooms = new Map();

// How far in the future we schedule a playback change. Every client needs
// this long to receive the broadcast AND silently pre-roll its audio element
// (decoder warm-up + buffering) so that the scheduled instant costs nothing
// but a gain change. Too low and slow devices miss the window and start late;
// too high and the host feels lag after pressing play.
// LAN: 600-800ms is comfortable. Internet/mobile: try 1000-1500ms.
const BUFFER_MS = 800;

const TRACK_FILES = ['song1.wav', 'song2.wav', 'song3.wav', 'song4.m4a', 'song5.m4a', 'song6.m4a'];

function formatTrackName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const TRACKS = Object.fromEntries(
  TRACK_FILES.map((filename) => {
    const id = filename.replace(/\.[^.]+$/, '');
    return [
      id,
      {
        id,
        name: formatTrackName(filename),
        url: `/audio/${filename}`
      }
    ];
  })
);

/**
 * Generates a random 6-character uppercase room code
 * Example: "A7K2PQ"
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Gets a room by code (case-insensitive)
 */
function getRoom(code) {
  return rooms.get(code.toUpperCase());
}

function getPublicUser(user) {
  return {
    socketId: user.socketId,
    name: user.name,
    isHost: user.isHost,
    trackStatus: user.trackStatus ?? 'idle'
  };
}

function getRoomState(room) {
  return {
    roomCode: room.roomCode,
    users: room.users.map(getPublicUser),
    currentTrack: room.currentTrack ?? null,
    // Sent as the raw anchor (status/position-at-scheduleAt/scheduleAt) so
    // late joiners run the exact same "expected position" math as clients
    // that were already connected when the scheduled change fired.
    playbackState: room.playbackState
  };
}

function createPlaybackState() {
  return {
    status: 'stopped',
    position: 0,
    scheduleAt: null
  };
}

/**
 * Computes what the playback position would be AT a given wall-clock time,
 * given a playbackState anchor (position at scheduleAt). Used both for
 * "position right now" (late joiners) and for computing the anchor of the
 * NEXT scheduled state from the current one (e.g. pause needs to know the
 * position at the moment the pause actually takes effect, not at the moment
 * the command was received).
 */
function getPositionAtTime(playbackState, atTime) {
  if (!playbackState) {
    return 0;
  }

  if (playbackState.status !== 'playing' || !playbackState.scheduleAt) {
    return playbackState.position ?? 0;
  }

  if (atTime < playbackState.scheduleAt) {
    // Scheduled play hasn't actually started yet at this point in time.
    return playbackState.position;
  }

  return playbackState.position + Math.max(0, (atTime - playbackState.scheduleAt) / 1000);
}

function getPlaybackPosition(playbackState) {
  return getPositionAtTime(playbackState, Date.now());
}

function emitPlaybackState(roomCode, room, action) {
  io.to(roomCode).emit('playback-state-updated', {
    roomCode,
    action,
    playbackState: room.playbackState
  });
}

/**
 * Broadcasts the current user list to everyone in a room
 */
function broadcastRoomUsers(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // io.to(roomCode).emit() sends to ALL sockets in that room (including sender)
  io.to(roomCode).emit('room-users', getRoomState(room));
}

function logRoomCount(roomCode, room) {
  console.log(`Room ${roomCode} now has ${room.users.length} user${room.users.length === 1 ? '' : 's'}.`);
}

function removeUserFromRoom(socket, reason = 'disconnect') {
  let roomCode = null;
  let room = null;
  let removedUser = null;

  for (const [code, existingRoom] of rooms.entries()) {
    const userIndex = existingRoom.users.findIndex((user) => user.socketId === socket.id);
    if (userIndex !== -1) {
      roomCode = code;
      room = existingRoom;
      removedUser = existingRoom.users[userIndex];
      existingRoom.users.splice(userIndex, 1);
      socket.leave(code);
      break;
    }
  }

  if (!room || !removedUser) {
    return null;
  }

  console.log(reason === 'leave-room' ? 'User left room:' : 'User disconnected:');
  console.log(`Name: ${removedUser.name}`);
  console.log(`Room: ${roomCode}`);
  console.log(`Socket: ${socket.id}`);

  if (room.users.length === 0) {
    rooms.delete(roomCode);
    console.log(`Room ${roomCode} deleted because it is empty.`);
    return { roomCode, roomDeleted: true, removedUser };
  }

  if (room.host === socket.id) {
    room.users.forEach((user, index) => {
      user.isHost = index === 0;
    });
    room.host = room.users[0].socketId;
    console.log('Host left room.');
    console.log(`New host: ${room.users[0].name}`);
  } else {
    room.users.forEach((user) => {
      user.isHost = user.socketId === room.host;
    });
  }

  logRoomCount(roomCode, room);
  broadcastRoomUsers(roomCode);

  return { roomCode, roomDeleted: false, removedUser };
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // ------------------------------------------------------------
  // CREATE ROOM
  // Client sends: { name: "Jenil" }
  // Server responds with: room-created { roomCode, users } or room-error { message }
  // ------------------------------------------------------------
  socket.on('create-room', ({ name }) => {
    // Validate name
    if (!name || !name.trim()) {
      socket.emit('room-error', { message: 'Name cannot be empty' });
      return;
    }

    // Generate unique room code
    let roomCode;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      attempts++;
      if (attempts > 100) {
        socket.emit('room-error', { message: 'Could not generate room code' });
        return;
      }
    } while (rooms.has(roomCode));

    // Create room with host
    const room = {
      roomCode,
      host: socket.id,
      users: [{
        socketId: socket.id,
        name: name.trim(),
        isHost: true,
        trackStatus: 'idle'
      }],
      currentTrack: null,
      playbackState: createPlaybackState()
    };

    rooms.set(roomCode, room);

    // Join the Socket.IO room
    // socket.join(roomCode) adds this socket to the "roomCode" room
    // This allows us to use io.to(roomCode).emit() to broadcast to all members
    socket.join(roomCode);

    console.log(`Room created: ${roomCode}`);
    console.log(`Host: ${name.trim()}`);
    console.log(`Socket: ${socket.id}`);
    logRoomCount(roomCode, room);

    // Send success response to creator
    socket.emit('room-created', {
      roomCode,
      users: room.users.map(getPublicUser),
      currentTrack: room.currentTrack,
      playbackState: room.playbackState
    });

    // Broadcast updated user list to everyone in room (currently just the host)
    broadcastRoomUsers(roomCode);
  });

  // ------------------------------------------------------------
  // JOIN ROOM
  // Client sends: { name: "Raj", roomCode: "A7K2PQ" }
  // Server responds with: room-joined { roomCode, users } or room-error { message }
  // ------------------------------------------------------------
  socket.on('join-room', ({ name, roomCode }) => {
    // Validate inputs
    if (!name || !name.trim()) {
      socket.emit('room-error', { message: 'Name cannot be empty' });
      return;
    }
    if (!roomCode || !roomCode.trim()) {
      socket.emit('room-error', { message: 'Room code cannot be empty' });
      return;
    }

    const code = roomCode.trim().toUpperCase();
    const room = rooms.get(code);

    // Room doesn't exist
    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    const existingSocket = room.users.find(u => u.socketId === socket.id);
    if (existingSocket) {
      socket.emit('room-error', { message: 'Socket is already in this room' });
      return;
    }

    // Add user to room
    room.users.push({
      socketId: socket.id,
      name: name.trim(),
      isHost: false, // Only original creator is host
      trackStatus: room.currentTrack ? 'loading' : 'idle'
    });

    // Join the Socket.IO room
    socket.join(code);

    console.log('User joined room:');
    console.log(`Name: ${name.trim()}`);
    console.log(`Room: ${code}`);
    console.log(`Socket: ${socket.id}`);
    logRoomCount(code, room);

    // Send success response to joining user
    socket.emit('room-joined', {
      roomCode: code,
      users: room.users.map(getPublicUser),
      currentTrack: room.currentTrack,
      playbackState: room.playbackState
    });

    // Broadcast updated user list to EVERYONE in the room (including the new user)
    broadcastRoomUsers(code);
  });

  // ------------------------------------------------------------
  // GET ROOM STATE
  // Client requests current room data on mount (fixes race condition)
  // ------------------------------------------------------------
  socket.on('get-room-state', ({ roomCode }) => {
    const code = roomCode.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }
    socket.emit('room-users', getRoomState(room));
  });

  socket.on('select-track', ({ roomCode, trackId }) => {
    const code = roomCode?.trim()?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    if (socket.id !== room.host) {
      socket.emit('room-error', { message: 'Only the host can select a track' });
      return;
    }

    const track = TRACKS[trackId];
    if (!track) {
      socket.emit('room-error', { message: 'Invalid track selection' });
      return;
    }

    room.currentTrack = track;
    room.playbackState = createPlaybackState();
    room.users.forEach((user) => {
      user.trackStatus = 'loading';
    });

    console.log(`Track selected in ${code}: ${track.name} (${track.id})`);
    broadcastRoomUsers(code);
    io.to(code).emit('track-selected', { roomCode: code, track });
    emitPlaybackState(code, room, 'stop');
  });

  socket.on('track-ready', ({ roomCode, trackId }) => {
    const code = roomCode?.trim()?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      return;
    }

    const user = room.users.find((entry) => entry.socketId === socket.id);
    if (!user || !room.currentTrack || room.currentTrack.id !== trackId) {
      return;
    }

    user.trackStatus = 'ready';
    console.log(`Track ready: ${user.name} in ${code} for ${trackId}`);
    broadcastRoomUsers(code);
  });

  socket.on('track-error', ({ roomCode, trackId }) => {
    const code = roomCode?.trim()?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      return;
    }

    const user = room.users.find((entry) => entry.socketId === socket.id);
    if (!user || !room.currentTrack || room.currentTrack.id !== trackId) {
      return;
    }

    user.trackStatus = 'error';
    console.log(`Track error: ${user.name} in ${code} for ${trackId}`);
    broadcastRoomUsers(code);
  });

  socket.on('leave-room', ({ roomCode }) => {
    const code = roomCode?.trim()?.toUpperCase();
    const room = code ? rooms.get(code) : null;

    if (!room) {
      return;
    }

    const user = room.users.find((entry) => entry.socketId === socket.id);
    if (!user) {
      return;
    }

    removeUserFromRoom(socket, 'leave-room');
  });

  socket.on('play-track', ({ roomCode }) => {
    const code = roomCode?.trim()?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    if (socket.id !== room.host) {
      socket.emit('room-error', { message: 'Only the host can control playback' });
      return;
    }

    if (!room.currentTrack) {
      socket.emit('room-error', { message: 'Select a song before pressing play' });
      return;
    }

    const notReadyUsers = room.users.filter((user) => user.trackStatus !== 'ready');
    if (notReadyUsers.length > 0) {
      socket.emit('room-error', { message: 'Wait for every device to finish loading the current song' });
      return;
    }

    const now = Date.now();
    const scheduleAt = now + BUFFER_MS;
    const startPosition = getPositionAtTime(room.playbackState, now);

    room.playbackState = {
      status: 'playing',
      position: startPosition,
      scheduleAt
    };

    console.log(`[Scheduler] play in ${code}: scheduleAt=${scheduleAt} (+${BUFFER_MS}ms), startPosition=${startPosition.toFixed(2)}s`);
    emitPlaybackState(code, room, 'play');
  });

  socket.on('pause-track', ({ roomCode }) => {
    const code = roomCode?.trim()?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    if (socket.id !== room.host) {
      socket.emit('room-error', { message: 'Only the host can control playback' });
      return;
    }

    if (!room.currentTrack) {
      socket.emit('room-error', { message: 'No song is currently selected' });
      return;
    }

    const now = Date.now();
    const scheduleAt = now + BUFFER_MS;
    // Playback keeps advancing until the scheduled instant, so the frozen
    // position after pause is the position AT scheduleAt, not right now.
    const positionAtSchedule = getPositionAtTime(room.playbackState, scheduleAt);

    room.playbackState = {
      status: 'paused',
      position: positionAtSchedule,
      scheduleAt
    };

    console.log(`[Scheduler] pause in ${code}: scheduleAt=${scheduleAt} (+${BUFFER_MS}ms), positionAtSchedule=${positionAtSchedule.toFixed(2)}s`);
    emitPlaybackState(code, room, 'pause');
  });

  socket.on('stop-track', ({ roomCode }) => {
    const code = roomCode?.trim()?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    if (socket.id !== room.host) {
      socket.emit('room-error', { message: 'Only the host can control playback' });
      return;
    }

    if (!room.currentTrack) {
      socket.emit('room-error', { message: 'No song is currently selected' });
      return;
    }

    const scheduleAt = Date.now() + BUFFER_MS;

    room.playbackState = {
      status: 'stopped',
      position: 0,
      scheduleAt
    };

    console.log(`[Scheduler] stop in ${code}: scheduleAt=${scheduleAt} (+${BUFFER_MS}ms)`);
    emitPlaybackState(code, room, 'stop');
  });

  socket.on('seek-track', ({ roomCode, position }) => {
    const code = roomCode?.trim()?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    if (socket.id !== room.host) {
      socket.emit('room-error', { message: 'Only the host can control playback' });
      return;
    }

    if (!room.currentTrack) {
      socket.emit('room-error', { message: 'No song is currently selected' });
      return;
    }

    if (!Number.isFinite(position) || position < 0) {
      socket.emit('room-error', { message: 'Seek position must be a valid non-negative number' });
      return;
    }

    const scheduleAt = Date.now() + BUFFER_MS;

    room.playbackState = {
      status: room.playbackState.status,
      position,
      scheduleAt
    };

    console.log(`[Scheduler] seek in ${code}: scheduleAt=${scheduleAt} (+${BUFFER_MS}ms), position=${position.toFixed(2)}s, status=${room.playbackState.status}`);
    emitPlaybackState(code, room, 'seek');
  });

  // ------------------------------------------------------------
  // DISCONNECT HANDLING
  // When a socket disconnects (tab close, refresh, network loss):
  // 1. Find which room they were in
  // 2. Remove them from the room
  // 3. If host left, assign new host
  // 4. If room empty, delete it
  // 5. Broadcast updated list
  // ------------------------------------------------------------
  socket.on('disconnect', () => {
    removeUserFromRoom(socket, 'disconnect');
  });

  socket.on('ping', (callback) => {
    if (typeof callback === 'function') callback();
  });

  // ------------------------------------------------------------
  // CLOCK SYNC
  // Client sends its own Date.now(); we echo ours back via the ack
  // callback. Client computes RTT and offset = serverTime - (clientTime + rtt/2).
  // ------------------------------------------------------------
  socket.on('clock-sync', (data, callback) => {
    if (typeof callback === 'function') {
      callback({ serverTime: Date.now(), clientTime: data?.clientTime ?? null });
    }
  });
});

const PORT = process.env.PORT || 3000;

// Listen on ALL network interfaces (0.0.0.0) so phones on same Wi-Fi can connect
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access from LAN: http://<your-laptop-ip>:${PORT}`);
});
