import { io, Socket } from "socket.io-client";
import type { PlaybackState, Room, Song, User } from "@/types";
import { SOCKET_URL } from "@/config";

export type SocketEventMap = {
  roomJoined: (room: Room) => void;
  roomLeft: () => void;
  userJoined: (user: User) => void;
  userLeft: (userId: string) => void;
  play: (state: PlaybackState) => void;
  pause: (state: PlaybackState) => void;
  seek: (position: number) => void;
  songChanged: (song: Song) => void;
  syncPosition: (position: number) => void;
  disconnect: () => void;
  reconnect: () => void;
  hostChanged: (userId: string) => void;
  latencyUpdate: (latency: number) => void;
  error: (message: string) => void;
};

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): void {
  getSocket().connect();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function onEvent<K extends keyof SocketEventMap>(
  event: K,
  handler: SocketEventMap[K]
): () => void {
  const s = getSocket();
  s.on(event as string, handler as (...args: unknown[]) => void);
  return () => {
    s.off(event as string, handler as (...args: unknown[]) => void);
  };
}
