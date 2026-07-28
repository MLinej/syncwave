export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  coverUrl?: string;
  trackNumber?: number;
  url?: string; // audio file path from backend
}

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  isHost: boolean;
  latency?: number; // ms
  isOnline: boolean;
  trackStatus?: 'idle' | 'loading' | 'ready' | 'error';
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  isLive: boolean;
  isSynced: boolean;
  connectedUsers: User[];
  createdAt: string;
}

export interface PlaybackState {
  currentSong: Song | null;
  isPlaying: boolean;
  position: number; // seconds
  volume: number; // 0-1
  isSynced: boolean;
}

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface AppState {
  currentUser: User | null;
  room: Room | null;
  songs: Song[];
  playback: PlaybackState;
  socketStatus: SocketStatus;
  latency: number;
  isLoading: boolean;
  error: string | null;
}

export type NavItem = 'dashboard' | 'create-room' | 'join-room' | 'my-rooms' | 'connected-users' | 'settings' | 'about';
