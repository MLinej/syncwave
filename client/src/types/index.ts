export type TrackSource = "library" | "youtube";

export interface Track {
  id: string;
  source: TrackSource;
  title: string;
  artist: string;
  duration: number | null; // seconds
  thumbnail: string | null;
  url?: string; // library tracks: path on the backend
  videoId?: string; // youtube tracks
}

export interface MemberRef {
  id: string;
  name: string;
}

export interface QueueItem {
  uid: string;
  track: Track;
  addedBy: MemberRef | null;
}

export interface Suggestion {
  uid: string;
  track: Track;
  by: MemberRef;
  votes: string[];
  createdAt: number;
}

export type TrackStatus = "idle" | "loading" | "ready" | "error";

export interface Member {
  id: string;
  name: string;
  isHost: boolean;
  online: boolean;
  trackStatus: TrackStatus;
  joinedAt: number;
}

export interface PlaybackState {
  status: "idle" | "paused" | "playing";
  trackUid: string | null;
  position: number; // seconds, the position AT scheduleAt
  scheduleAt: number | null; // server clock (ms) when this state takes effect
  pendingStart: boolean; // host pressed play, room is waiting for devices
}

export interface RoomState {
  code: string;
  hostId: string | null;
  members: Member[];
  current: QueueItem | null;
  queue: QueueItem[];
  suggestions: Suggestion[];
  repeat: RepeatMode;
  hasPrevious: boolean;
  playback: PlaybackState;
}

export type RepeatMode = "off" | "all" | "one";

export interface Session {
  code: string;
  name: string;
}

export type QueueMode = "now" | "next" | "last";
