import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import cors from 'cors';
import { resolveYouTube, sanitizeYouTubeTrack, searchYouTube, youtubeSearchEnabled } from './lib/youtube.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, 'public/audio');
const CLIENT_DIST = path.join(__dirname, '../client/dist');
const PORT = Number(process.env.PORT) || 3000;
// Allowed browser origins, comma-separated. Entries may use one "*" wildcard,
// e.g. "https://syncwave.vercel.app,https://syncwave-*.vercel.app" to also
// allow Vercel preview deploys. Unset = allow any origin (fine for LAN dev).
const CORS_ORIGIN = process.env.CORS_ORIGIN?.trim() || '*';
const allowedOrigins = CORS_ORIGIN === '*'
  ? null
  : CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean).map((o) =>
      new RegExp('^' + o.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]+') + '$', 'i')
    );
// Requests without an Origin header (curl, health checks, same-origin) pass.
const corsOrigin = (origin, callback) => {
  callback(null, !allowedOrigins || !origin || allowedOrigins.some((re) => re.test(origin)));
};

// --- Timing -------------------------------------------------------------
// Every playback change is scheduled this far in the future so each device
// can receive it and pre-roll before the audible instant. Web Audio needs
// very little; the YouTube embed needs more because play/seek are slower.
const LEAD_MS = { library: 700, youtube: 1400 };
const PAUSE_LEAD_MS = 250;
// After a track change or a play request we wait for every online device to
// report "ready", but never longer than this — one slow phone must not hold
// the whole room hostage. Late devices simply join mid-track, in sync.
const READY_TIMEOUT_MS = 8000;

// --- Membership ---------------------------------------------------------
// Phones drop their socket whenever the screen locks or the network hops.
// Members are keyed by a persistent clientId and kept for a grace period, so
// a reconnect resumes the same seat (including the host role).
const HOST_GRACE_MS = 20_000;
const MEMBER_GRACE_MS = 90_000;
const EMPTY_ROOM_TTL_MS = 10 * 60_000;

const LIMITS = {
  members: 50,
  queue: 200,
  suggestions: 100,
  pendingSuggestionsPerMember: 5,
  name: 24,
  history: 25
};

// Monotonic server clock (ms). Clients sync to this, so it must never jump
// the way Date.now() can when the OS adjusts the wall clock.
const serverNow = () => performance.timeOrigin + performance.now();
const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

// ------------------------------------------------------------------------
// Library (files in server/public/audio)
// ------------------------------------------------------------------------
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i;
const libraryDurations = new Map(); // id -> seconds, reported by clients

function prettifyName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getLibrary() {
  let files = [];
  try {
    files = fs.readdirSync(AUDIO_DIR).filter((f) => AUDIO_EXT.test(f)).sort();
  } catch {
    /* no library folder */
  }
  return files.map((filename) => {
    const id = `lib:${filename}`;
    return {
      source: 'library',
      id,
      title: prettifyName(filename),
      artist: 'Room library',
      duration: libraryDurations.get(id) ?? null,
      thumbnail: null,
      url: `/audio/${encodeURIComponent(filename)}`
    };
  });
}

function resolveTrack(input) {
  if (input?.source === 'youtube') return sanitizeYouTubeTrack(input);
  if (input?.source === 'library') return getLibrary().find((t) => t.id === input.id) ?? null;
  return null;
}

// ------------------------------------------------------------------------
// HTTP
// ------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
// Behind Render's (or any) reverse proxy: use the real client IP from
// X-Forwarded-For, otherwise every user shares one rate-limit bucket.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use(cors({ origin: corsOrigin }));
app.use('/audio', express.static(AUDIO_DIR, { maxAge: '7d', acceptRanges: true }));

// Tiny per-IP limiter for the endpoints that spend YouTube quota.
const httpHits = new Map();
function rateLimit(limit, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = httpHits.get(key);
    if (!entry || now - entry.start > windowMs) {
      httpHits.set(key, { start: now, count: 1 });
      return next();
    }
    if (++entry.count > limit) {
      return res.status(429).json({ error: 'Too many requests — slow down a little' });
    }
    next();
  };
}
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, entry] of httpHits) if (entry.start < cutoff) httpHits.delete(key);
}, 60_000).unref();

app.get('/api/health', (req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: Math.round(process.uptime()) });
});

app.get('/api/config', (req, res) => {
  res.json({ youtubeSearch: youtubeSearchEnabled() });
});

app.get('/api/library', (req, res) => {
  res.json({ items: getLibrary() });
});

app.get('/api/youtube/search', rateLimit(30, 60_000), async (req, res) => {
  try {
    res.json({ items: await searchYouTube(req.query.q) });
  } catch (err) {
    console.warn('[youtube] search failed:', err.message);
    res.status(err.status === 501 ? 501 : 502).json({ error: err.status === 501 ? err.message : 'YouTube search failed. Try again.' });
  }
});

app.get('/api/youtube/resolve', rateLimit(60, 60_000), async (req, res) => {
  try {
    res.json({ item: await resolveYouTube(req.query.url) });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || 'Could not load that video' });
  }
});

// Serve the production client build when it exists (single-port deploy).
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|audio\/|socket\.io\/).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
  console.log('Serving client build from', CLIENT_DIST);
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  // Browsers don't apply CORS to WebSockets, so check the Origin ourselves.
  allowRequest: (req, callback) => corsOrigin(req.headers.origin, (err, ok) => callback(err, ok)),
  pingInterval: 10_000,
  pingTimeout: 8_000
});

// ------------------------------------------------------------------------
// Rooms
// ------------------------------------------------------------------------
/** @type {Map<string, any>} */
const rooms = new Map();

function generateRoomCode() {
  // No 0/O/1/I — codes get read aloud and typed on phones.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(chars.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error('Could not allocate a room code');
}

function createRoom() {
  const room = {
    code: generateRoomCode(),
    hostId: null,
    createdAt: Date.now(),
    members: new Map(),
    current: null,
    queue: [],
    suggestions: [],
    history: [], // previously played items, most recent last (for "previous")
    repeat: 'off', // 'off' | 'all' | 'one'
    playback: { status: 'idle', trackUid: null, position: 0, scheduleAt: null },
    pendingStart: false,
    timers: { start: null, end: null, host: null, empty: null }
  };
  rooms.set(room.code, room);
  return room;
}

function clearTimer(room, name) {
  if (room.timers[name]) {
    clearTimeout(room.timers[name]);
    room.timers[name] = null;
  }
}

function deleteRoom(room) {
  Object.keys(room.timers).forEach((name) => clearTimer(room, name));
  room.members.forEach((m) => clearTimeout(m.removeTimer));
  rooms.delete(room.code);
  console.log(`[room ${room.code}] deleted`);
}

// Members are keyed internally by their secret clientId, which doubles as a
// reconnect credential. It must never leave the server: everything other
// clients see uses the member's random publicId instead.
function publicIdOf(room, clientId) {
  return room.members.get(clientId)?.publicId ?? null;
}

function snapshot(room) {
  const members = [...room.members.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((m) => ({
      id: m.publicId,
      name: m.name,
      isHost: m.id === room.hostId,
      online: m.online,
      trackStatus: m.trackStatus,
      joinedAt: m.joinedAt
    }));
  const suggestions = [...room.suggestions]
    .sort((a, b) => b.votes.size - a.votes.size || a.createdAt - b.createdAt)
    .map((s) => ({
      uid: s.uid,
      track: s.track,
      by: { id: s.by.publicId, name: s.by.name },
      votes: [...s.votes].map((id) => publicIdOf(room, id)).filter(Boolean),
      createdAt: s.createdAt
    }));
  return {
    code: room.code,
    hostId: publicIdOf(room, room.hostId),
    members,
    current: room.current,
    queue: room.queue,
    suggestions,
    repeat: room.repeat,
    hasPrevious: room.history.length > 0,
    playback: { ...room.playback, pendingStart: room.pendingStart }
  };
}

function broadcast(room) {
  io.to(room.code).emit('room:state', snapshot(room));
}

function notifyMember(room, memberId, message) {
  const member = room.members.get(memberId);
  if (member?.socketId) io.to(member.socketId).emit('room:notice', { message });
}

function onlineMembers(room) {
  return [...room.members.values()].filter((m) => m.online);
}

// ------------------------------------------------------------------------
// Playback scheduling
// ------------------------------------------------------------------------
function positionAt(playback, t) {
  if (playback.status !== 'playing' || playback.scheduleAt === null || t < playback.scheduleAt) {
    return playback.position;
  }
  return playback.position + (t - playback.scheduleAt) / 1000;
}

function trackDuration(room) {
  return room.current?.track.duration ?? null;
}

function leadFor(room) {
  return LEAD_MS[room.current?.track.source] ?? LEAD_MS.library;
}

function scheduleEnd(room) {
  clearTimer(room, 'end');
  const pb = room.playback;
  const duration = trackDuration(room);
  if (pb.status !== 'playing' || !duration) return;
  const endsAt = pb.scheduleAt + (duration - pb.position) * 1000;
  room.timers.end = setTimeout(() => advance(room, { ended: true }), Math.max(0, endsAt - serverNow()) + 400);
}

function cancelPendingStart(room) {
  clearTimer(room, 'start');
  room.pendingStart = false;
}

function devicesStillLoading(room) {
  return onlineMembers(room).filter((m) => m.trackStatus === 'loading');
}

function startPlayback(room) {
  cancelPendingStart(room);
  if (!room.current) return;
  const t = serverNow();
  let position = positionAt(room.playback, t);
  const duration = trackDuration(room);
  if (duration && position >= duration - 0.5) position = 0;

  room.playback = {
    status: 'playing',
    trackUid: room.current.uid,
    position,
    scheduleAt: t + leadFor(room)
  };
  scheduleEnd(room);
  broadcast(room);
}

// Start as soon as every online device has the track ready (or the timeout hits).
function requestStart(room) {
  if (!room.current || room.playback.status === 'playing') return;
  if (devicesStillLoading(room).length === 0) {
    startPlayback(room);
    return;
  }
  if (!room.pendingStart) {
    room.pendingStart = true;
    room.timers.start = setTimeout(() => startPlayback(room), READY_TIMEOUT_MS);
  }
  broadcast(room);
}

function pausePlayback(room) {
  cancelPendingStart(room);
  clearTimer(room, 'end');
  if (room.playback.status !== 'playing') {
    broadcast(room);
    return;
  }
  const at = serverNow() + PAUSE_LEAD_MS;
  room.playback = {
    status: 'paused',
    trackUid: room.playback.trackUid,
    position: positionAt(room.playback, at),
    scheduleAt: at
  };
  broadcast(room);
}

function seekPlayback(room, position) {
  const duration = trackDuration(room);
  const clamped = Math.max(0, duration ? Math.min(position, duration - 0.25) : position);
  const playing = room.playback.status === 'playing';
  room.playback = {
    status: playing ? 'playing' : 'paused',
    trackUid: room.playback.trackUid,
    position: clamped,
    scheduleAt: serverNow() + (playing ? leadFor(room) : 0)
  };
  scheduleEnd(room);
  broadcast(room);
}

function setCurrent(room, item, { autoplay, recordHistory = true }) {
  cancelPendingStart(room);
  clearTimer(room, 'end');
  if (recordHistory && room.current && room.current !== item) {
    room.history.push(room.current);
    if (room.history.length > LIMITS.history) room.history.shift();
  }
  room.current = item;
  room.playback = {
    status: item ? 'paused' : 'idle',
    trackUid: item?.uid ?? null,
    position: 0,
    scheduleAt: null
  };
  room.members.forEach((m) => {
    m.trackStatus = item && m.online ? 'loading' : 'idle';
  });
  if (item) console.log(`[room ${room.code}] now: ${item.track.title} (${item.track.source})`);
  if (item && autoplay) requestStart(room);
  else broadcast(room);
}

function advance(room, { ended = false } = {}) {
  // Repeat one: a song that finishes on its own starts over.
  if (ended && room.repeat === 'one' && room.current) {
    room.playback = { status: 'paused', trackUid: room.current.uid, position: 0, scheduleAt: null };
    startPlayback(room);
    return;
  }
  // Repeat all: the finished song goes to the back of the queue.
  if (room.repeat === 'all' && room.current) {
    room.queue.push({ ...room.current, uid: uid() });
  }
  const next = room.queue.shift();
  if (next) {
    setCurrent(room, next, { autoplay: true });
    return;
  }
  // End of queue: park the last song at the start, paused.
  cancelPendingStart(room);
  clearTimer(room, 'end');
  room.playback = { status: 'paused', trackUid: room.current?.uid ?? null, position: 0, scheduleAt: serverNow() };
  broadcast(room);
}

function previous(room) {
  const position = positionAt(room.playback, serverNow());
  // Like every music player: past the first few seconds, "previous" restarts.
  if (!room.current || position > 3 || room.history.length === 0) {
    if (room.current) seekPlayback(room, 0);
    return;
  }
  const prev = room.history.pop();
  room.queue.unshift(room.current);
  setCurrent(room, prev, { autoplay: true, recordHistory: false });
}

function makeQueueItem(track, addedBy) {
  return { uid: uid(), track, addedBy: addedBy ? { id: addedBy.publicId, name: addedBy.name } : null };
}

function isTrackQueued(room, trackId) {
  return room.current?.track.id === trackId || room.queue.some((item) => item.track.id === trackId);
}

function enqueue(room, item, mode) {
  if (!room.current || mode === 'now') {
    setCurrent(room, item, { autoplay: true });
    return;
  }
  if (room.queue.length >= LIMITS.queue) throw new Error('The queue is full');
  if (mode === 'next') room.queue.unshift(item);
  else room.queue.push(item);
  broadcast(room);
}

// ------------------------------------------------------------------------
// Membership
// ------------------------------------------------------------------------
function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
}

function validClientId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

function reassignHost(room) {
  clearTimer(room, 'host');
  const candidates = onlineMembers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  const next = candidates[0] ?? [...room.members.values()][0];
  if (!next || next.id === room.hostId) return;
  room.hostId = next.id;
  console.log(`[room ${room.code}] host -> ${next.name}`);
  notifyMember(room, next.id, 'You are now the host');
}

function removeMember(room, memberId) {
  const member = room.members.get(memberId);
  if (!member) return;
  clearTimeout(member.removeTimer);
  room.members.delete(memberId);
  room.suggestions.forEach((s) => s.votes.delete(memberId));

  if (room.members.size === 0) {
    deleteRoom(room);
    return;
  }
  if (room.hostId === memberId) reassignHost(room);
  if (room.pendingStart && devicesStillLoading(room).length === 0) startPlayback(room);
  else broadcast(room);
}

function attach(socket, room, clientId, name) {
  if (socket.data.code && socket.data.code !== room.code) detach(socket, { leaving: true });

  let member = room.members.get(clientId);
  if (member) {
    // Same device reconnecting, or the same browser opening a second tab.
    if (member.socketId && member.socketId !== socket.id) {
      const previous = io.sockets.sockets.get(member.socketId);
      if (previous) {
        previous.emit('room:kicked', { reason: 'You opened this room on another tab' });
        previous.leave(room.code);
        previous.data.code = null;
      }
    }
    clearTimeout(member.removeTimer);
    member.removeTimer = null;
  } else {
    if (room.members.size >= LIMITS.members) throw new Error('This room is full');
    member = { id: clientId, publicId: uid(), joinedAt: Date.now(), removeTimer: null };
    room.members.set(clientId, member);
  }

  member.name = name;
  member.socketId = socket.id;
  member.online = true;
  member.trackStatus = room.current ? 'loading' : 'idle';

  if (!room.hostId) room.hostId = clientId;
  if (room.hostId === clientId) clearTimer(room, 'host');
  clearTimer(room, 'empty');

  socket.join(room.code);
  socket.data.code = room.code;
  socket.data.clientId = clientId;
  broadcast(room);
  // `you` is this device's own public id, so it can recognise itself in snapshots.
  return { state: snapshot(room), you: member.publicId };
}

function detach(socket, { leaving }) {
  const room = socket.data.code ? rooms.get(socket.data.code) : null;
  socket.data.code = null;
  if (!room) return;
  socket.leave(room.code);

  const member = room.members.get(socket.data.clientId);
  if (!member || member.socketId !== socket.id) return;

  if (leaving) {
    removeMember(room, member.id);
    return;
  }

  member.online = false;
  member.socketId = null;
  member.removeTimer = setTimeout(() => removeMember(room, member.id), MEMBER_GRACE_MS);
  if (room.hostId === member.id) {
    clearTimer(room, 'host');
    room.timers.host = setTimeout(() => {
      reassignHost(room);
      broadcast(room);
    }, HOST_GRACE_MS);
  }
  if (onlineMembers(room).length === 0) {
    clearTimer(room, 'empty');
    room.timers.empty = setTimeout(() => deleteRoom(room), EMPTY_ROOM_TTL_MS);
  }
  if (room.pendingStart && devicesStillLoading(room).length === 0) startPlayback(room);
  else broadcast(room);
}

// ------------------------------------------------------------------------
// Socket handlers
// ------------------------------------------------------------------------
class UserError extends Error {}

io.on('connection', (socket) => {
  socket.data.code = null;
  socket.data.clientId = null;

  // Per-socket flood guard (clock pings are exempt — they are the hot path).
  let windowStart = Date.now();
  let count = 0;
  socket.use(([event], next) => {
    if (event === 'clock') return next();
    const now = Date.now();
    if (now - windowStart > 10_000) {
      windowStart = now;
      count = 0;
    }
    if (++count > 80) return next(new Error('rate limited'));
    next();
  });

  // Clock sync fast path: the ack carries the server's monotonic clock.
  socket.on('clock', (ack) => {
    if (typeof ack === 'function') ack(serverNow());
  });

  // Registers an ack-style handler with uniform error handling.
  // ctx: { room, member, isHost } for events that require room membership.
  const handle = (event, fn, { needsRoom = true, hostOnly = false } = {}) => {
    socket.on(event, async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        let ctx = {};
        if (needsRoom) {
          const room = socket.data.code ? rooms.get(socket.data.code) : null;
          const member = room?.members.get(socket.data.clientId);
          if (!room || !member) throw new UserError('You are not in a room');
          const isHost = room.hostId === member.id;
          if (hostOnly && !isHost) throw new UserError('Only the host can do that');
          ctx = { room, member, isHost };
        }
        const result = await fn(payload ?? {}, ctx);
        reply({ ok: true, ...(result ?? {}) });
      } catch (err) {
        if (!(err instanceof UserError)) console.error(`[${event}]`, err);
        reply({ ok: false, error: err.message || 'Something went wrong' });
      }
    });
  };

  handle('room:create', ({ name, clientId }) => {
    const cleaned = cleanName(name);
    if (!cleaned) throw new UserError('Enter your name');
    if (!validClientId(clientId)) throw new UserError('Invalid client id');
    const room = createRoom();
    console.log(`[room ${room.code}] created by ${cleaned}`);
    return attach(socket, room, clientId, cleaned);
  }, { needsRoom: false });

  handle('room:join', ({ name, code, clientId }) => {
    const cleaned = cleanName(name);
    if (!cleaned) throw new UserError('Enter your name');
    if (!validClientId(clientId)) throw new UserError('Invalid client id');
    const room = rooms.get(String(code ?? '').trim().toUpperCase());
    if (!room) throw new UserError('Room not found — check the code');
    return attach(socket, room, clientId, cleaned);
  }, { needsRoom: false });

  handle('room:leave', () => {
    detach(socket, { leaving: true });
  }, { needsRoom: false });

  handle('host:transfer', ({ memberId }, { room }) => {
    const target = [...room.members.values()].find((m) => m.publicId === memberId);
    if (!target || !target.online) throw new UserError('That person is not online');
    room.hostId = target.id;
    clearTimer(room, 'host');
    notifyMember(room, target.id, 'You are now the host');
    broadcast(room);
  }, { hostOnly: true });

  // --- Device readiness ---------------------------------------------------
  handle('track:ready', ({ trackUid, duration }, { room, member }) => {
    if (!room.current || room.current.uid !== trackUid) return;
    member.trackStatus = 'ready';

    const reported = Number(duration);
    if (!room.current.track.duration && reported > 0 && reported < 6 * 3600) {
      room.current.track.duration = reported;
      if (room.current.track.source === 'library') libraryDurations.set(room.current.track.id, reported);
      scheduleEnd(room);
    }

    if (room.pendingStart && devicesStillLoading(room).length === 0) startPlayback(room);
    else broadcast(room);
  });

  handle('track:error', ({ trackUid }, { room, member }) => {
    if (!room.current || room.current.uid !== trackUid) return;
    member.trackStatus = 'error';
    if (room.pendingStart && devicesStillLoading(room).length === 0) startPlayback(room);
    else broadcast(room);
  });

  // --- Transport (host only) ----------------------------------------------
  handle('playback:play', (_, { room }) => {
    if (!room.current) throw new UserError('Add a song first');
    requestStart(room);
  }, { hostOnly: true });

  handle('playback:pause', (_, { room }) => pausePlayback(room), { hostOnly: true });

  handle('playback:seek', ({ position }, { room }) => {
    if (!room.current) throw new UserError('Nothing is playing');
    const value = Number(position);
    if (!Number.isFinite(value) || value < 0) throw new UserError('Invalid position');
    seekPlayback(room, value);
  }, { hostOnly: true });

  handle('playback:next', (_, { room }) => advance(room), { hostOnly: true });

  handle('playback:previous', (_, { room }) => previous(room), { hostOnly: true });

  handle('playback:repeat', ({ mode }, { room }) => {
    const modes = ['off', 'all', 'one'];
    room.repeat = modes.includes(mode) ? mode : modes[(modes.indexOf(room.repeat) + 1) % modes.length];
    broadcast(room);
  }, { hostOnly: true });

  handle('queue:shuffle', (_, { room }) => {
    for (let i = room.queue.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [room.queue[i], room.queue[j]] = [room.queue[j], room.queue[i]];
    }
    broadcast(room);
  }, { hostOnly: true });

  // --- Queue (host only) --------------------------------------------------
  handle('queue:add', ({ track, mode }, { room, member }) => {
    const resolved = resolveTrack(track);
    if (!resolved) throw new UserError('That song could not be added');
    enqueue(room, makeQueueItem(resolved, member), mode);
  }, { hostOnly: true });

  handle('queue:remove', ({ uid: itemUid }, { room }) => {
    room.queue = room.queue.filter((item) => item.uid !== itemUid);
    broadcast(room);
  }, { hostOnly: true });

  handle('queue:move', ({ uid: itemUid, delta, toIndex }, { room }) => {
    const from = room.queue.findIndex((item) => item.uid === itemUid);
    if (from === -1) return;
    const target = Number.isInteger(toIndex) ? toIndex : from + Math.sign(Number(delta) || 0);
    const to = Math.max(0, Math.min(room.queue.length - 1, target));
    const [item] = room.queue.splice(from, 1);
    room.queue.splice(to, 0, item);
    broadcast(room);
  }, { hostOnly: true });

  handle('queue:play', ({ uid: itemUid }, { room }) => {
    const index = room.queue.findIndex((item) => item.uid === itemUid);
    if (index === -1) throw new UserError('That song is no longer in the queue');
    const [item] = room.queue.splice(index, 1);
    setCurrent(room, item, { autoplay: true });
  }, { hostOnly: true });

  // --- Suggestions (everyone) ---------------------------------------------
  handle('suggest:add', ({ track }, { room, member }) => {
    const resolved = resolveTrack(track);
    if (!resolved) throw new UserError('That song could not be suggested');
    if (isTrackQueued(room, resolved.id)) throw new UserError("It's already in the queue");

    const existing = room.suggestions.find((s) => s.track.id === resolved.id);
    if (existing) {
      existing.votes.add(member.id);
      broadcast(room);
      return { duplicate: true };
    }
    const mine = room.suggestions.filter((s) => s.by.id === member.id).length;
    if (mine >= LIMITS.pendingSuggestionsPerMember) {
      throw new UserError(`You can have ${LIMITS.pendingSuggestionsPerMember} pending suggestions at a time`);
    }
    if (room.suggestions.length >= LIMITS.suggestions) throw new UserError('Too many pending suggestions');

    room.suggestions.push({
      uid: uid(),
      track: resolved,
      by: { id: member.id, publicId: member.publicId, name: member.name },
      votes: new Set([member.id]),
      createdAt: Date.now()
    });
    if (room.hostId !== member.id) notifyMember(room, room.hostId, `${member.name} suggested “${resolved.title}”`);
    broadcast(room);
  });

  handle('suggest:vote', ({ uid: suggestionUid }, { room, member }) => {
    const suggestion = room.suggestions.find((s) => s.uid === suggestionUid);
    if (!suggestion) throw new UserError('That suggestion is gone');
    if (suggestion.votes.has(member.id)) suggestion.votes.delete(member.id);
    else suggestion.votes.add(member.id);
    broadcast(room);
  });

  handle('suggest:accept', ({ uid: suggestionUid, mode }, { room }) => {
    const index = room.suggestions.findIndex((s) => s.uid === suggestionUid);
    if (index === -1) throw new UserError('That suggestion is gone');
    const [suggestion] = room.suggestions.splice(index, 1);
    const suggester = room.members.get(suggestion.by.id) ?? suggestion.by;
    enqueue(room, makeQueueItem(suggestion.track, suggester), mode);
    if (suggestion.by.id !== room.hostId) {
      notifyMember(room, suggestion.by.id, mode === 'now'
        ? `Now playing your pick: “${suggestion.track.title}”`
        : `The host queued your pick: “${suggestion.track.title}”`);
    }
  }, { hostOnly: true });

  handle('suggest:dismiss', ({ uid: suggestionUid }, { room, member, isHost }) => {
    const suggestion = room.suggestions.find((s) => s.uid === suggestionUid);
    if (!suggestion) return;
    if (!isHost && suggestion.by.id !== member.id) throw new UserError('Only the host can remove that');
    room.suggestions = room.suggestions.filter((s) => s.uid !== suggestionUid);
    broadcast(room);
  });

  socket.on('disconnect', () => detach(socket, { leaving: false }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SyncWave server listening on http://0.0.0.0:${PORT}`);
  console.log(`YouTube search: ${youtubeSearchEnabled() ? 'enabled' : 'disabled (set YOUTUBE_API_KEY to enable)'}`);
});
