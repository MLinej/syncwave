import type { Room, Song, PlaybackState, User } from "@/types";
import { getSocket } from "./socket";

const BASE_URL = "http://10.10.10.164:3000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Helper to wait for a socket event
function waitForSocketEvent<T>(successEvent: string, errorEvent: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for event: ${successEvent}`));
    }, timeoutMs);

    const onEvent = (data: T) => {
      cleanup();
      resolve(data);
    };

    const onError = (err: { message: string }) => {
      cleanup();
      reject(new Error(err.message));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(successEvent, onEvent);
      socket.off(errorEvent, onError);
    };

    socket.on(successEvent, onEvent);
    socket.on(errorEvent, onError);
  });
}

// Room endpoints
export async function createRoom(): Promise<Room> {
  const socket = getSocket();
  const userName = "Host User"; // TODO: Could pass from user state
  socket.emit("create-room", { name: userName });
  const data = await waitForSocketEvent<any>("room-created", "room-error");
  return mapBackendRoom(data);
}

export async function joinRoom(roomId: string): Promise<Room> {
  const socket = getSocket();
  const userName = "Guest User";
  socket.emit("join-room", { name: userName, roomCode: roomId });
  const data = await waitForSocketEvent<any>("room-joined", "room-error");
  return mapBackendRoom(data);
}

export async function leaveRoom(roomCode?: string): Promise<void> {
  const socket = getSocket();
  if (roomCode) {
      socket.emit("leave-room", { roomCode });
  }
}

export async function getRoom(roomId: string): Promise<Room> {
  const socket = getSocket();
  socket.emit("get-room-state", { roomCode: roomId });
  const data = await waitForSocketEvent<any>("room-users", "room-error");
  return mapBackendRoom(data);
}

export async function getConnectedUsers(roomId: string): Promise<User[]> {
  // Uses getRoom under the hood since room state contains users
  const room = await getRoom(roomId);
  return room.connectedUsers;
}

// Song endpoints
export async function getSongs(): Promise<Song[]> {
  const data = await request<any[]>("/songs");
  return data.map((track) => ({
    id: track.id,
    title: track.name,
    artist: "Unknown Artist",
    album: "Unknown Album",
    duration: 0,
    coverUrl: "",
    url: track.url
  }));
}

export async function getSong(songId: string): Promise<Song> {
  const songs = await getSongs();
  return songs.find(s => s.id === songId) as Song;
}

// Playback endpoints
export async function selectSong(songId: string, roomCode?: string): Promise<void> {
  const socket = getSocket();
  if (roomCode) {
    socket.emit("select-track", { roomCode, trackId: songId });
  }
}

export async function playSong(roomCode?: string): Promise<PlaybackState> {
  const socket = getSocket();
  if (roomCode) {
    socket.emit("play-track", { roomCode });
  }
  return getPlaybackState();
}

export async function stopSong(roomCode?: string): Promise<PlaybackState> {
  const socket = getSocket();
  if (roomCode) {
    socket.emit("stop-track", { roomCode });
  }
  return getPlaybackState();
}

export function emitTrackReady(roomCode: string, trackId: string) {
  const socket = getSocket();
  socket.emit("track-ready", { roomCode, trackId });
}

export async function pauseSong(roomCode?: string): Promise<PlaybackState> {
  const socket = getSocket();
  if (roomCode) {
      socket.emit("pause-track", { roomCode });
  }
  return getPlaybackState();
}

export async function seekSong(position: number, roomCode?: string): Promise<PlaybackState> {
  const socket = getSocket();
  if (roomCode) {
      socket.emit("seek-track", { roomCode, position });
  }
  return getPlaybackState();
}

export async function getPlaybackState(): Promise<PlaybackState> {
  return {
    currentSong: null,
    isPlaying: false,
    position: 0,
    volume: 1,
    isSynced: false
  };
}

// Mapper to map backend room structure to frontend Room structure
export function mapBackendRoom(data: any): Room {
  return {
    id: data.roomCode,
    code: data.roomCode,
    name: `Room ${data.roomCode}`,
    hostId: data.users?.find((u: any) => u.isHost)?.socketId || "",
    isLive: true,
    isSynced: true,
    connectedUsers: (data.users || []).map((u: any) => ({
      id: u.socketId,
      name: u.name,
      isHost: u.isHost,
      isOnline: true,
      latency: 0,
      trackStatus: u.trackStatus || 'idle'
    })),
    createdAt: new Date().toISOString()
  };
}
