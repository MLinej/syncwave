import { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type { AppState, Song, Room, User, PlaybackState, SocketStatus, NavItem } from "@/types";

interface AppContextValue extends AppState {
  roomCode: string | null;
  connectedUsers: User[];
  currentTrack: Song | null;
  playbackState: PlaybackState;
  socketConnected: boolean;
  isHost: boolean;
  loading: boolean;

  activeNav: NavItem;
  setActiveNav: (nav: NavItem) => void;
  setRoom: (room: Room | null) => void;
  setSongs: (songs: Song[]) => void;
  setPlayback: (state: Partial<PlaybackState>) => void;
  setSocketStatus: (status: SocketStatus) => void;
  setLatency: (ms: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentUser: (user: User | null) => void;
  updateRoomUsers: (users: User[]) => void;
}

type Action =
  | { type: "SET_ROOM"; payload: Room | null }
  | { type: "SET_SONGS"; payload: Song[] }
  | { type: "SET_PLAYBACK"; payload: Partial<PlaybackState> }
  | { type: "SET_SOCKET_STATUS"; payload: SocketStatus }
  | { type: "SET_LATENCY"; payload: number }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_CURRENT_USER"; payload: User | null }
  | { type: "SET_ACTIVE_NAV"; payload: NavItem }
  | { type: "UPDATE_ROOM_USERS"; payload: User[] };

const initialState: AppState & { activeNav: NavItem } = {
  currentUser: null,
  room: null,
  songs: [],
  playback: {
    currentSong: null,
    isPlaying: false,
    position: 0,
    volume: 0.75,
    isSynced: false,
  },
  socketStatus: "disconnected",
  latency: 0,
  isLoading: false,
  error: null,
  activeNav: "dashboard",
};

function reducer(state: typeof initialState, action: Action): typeof initialState {
  switch (action.type) {
    case "SET_ROOM":
      return { ...state, room: action.payload };
    case "SET_SONGS":
      return { ...state, songs: action.payload };
    case "SET_PLAYBACK":
      return { ...state, playback: { ...state.playback, ...action.payload } };
    case "SET_SOCKET_STATUS":
      return { ...state, socketStatus: action.payload };
    case "SET_LATENCY":
      return { ...state, latency: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_CURRENT_USER":
      return { ...state, currentUser: action.payload };
    case "SET_ACTIVE_NAV":
      return { ...state, activeNav: action.payload };
    case "UPDATE_ROOM_USERS":
      if (!state.room) return state;
      return { ...state, room: { ...state.room, connectedUsers: action.payload } };
    default:
      return state;
  }
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setRoom = useCallback((room: Room | null) => dispatch({ type: "SET_ROOM", payload: room }), []);
  const setSongs = useCallback((songs: Song[]) => dispatch({ type: "SET_SONGS", payload: songs }), []);
  const setPlayback = useCallback((p: Partial<PlaybackState>) => dispatch({ type: "SET_PLAYBACK", payload: p }), []);
  const setSocketStatus = useCallback((s: SocketStatus) => dispatch({ type: "SET_SOCKET_STATUS", payload: s }), []);
  const setLatency = useCallback((ms: number) => dispatch({ type: "SET_LATENCY", payload: ms }), []);
  const setLoading = useCallback((l: boolean) => dispatch({ type: "SET_LOADING", payload: l }), []);
  const setError = useCallback((e: string | null) => dispatch({ type: "SET_ERROR", payload: e }), []);
  const setCurrentUser = useCallback((u: User | null) => dispatch({ type: "SET_CURRENT_USER", payload: u }), []);
  const setActiveNav = useCallback((nav: NavItem) => dispatch({ type: "SET_ACTIVE_NAV", payload: nav }), []);
  const updateRoomUsers = useCallback((users: User[]) => dispatch({ type: "UPDATE_ROOM_USERS", payload: users }), []);

  const roomCode = state.room?.code ?? null;
  const connectedUsers = state.room?.connectedUsers ?? [];
  const currentTrack = state.playback.currentSong ?? null;
  const playbackState = state.playback;
  const socketConnected = state.socketStatus === "connected";
  // The host check: either match hostId with currentUser id, or check if currentUser has isHost locally set
  const isHost = state.currentUser ? state.room?.hostId === state.currentUser.id : false;
  const loading = state.isLoading;

  return (
    <AppContext.Provider value={{
      ...state,
      roomCode,
      connectedUsers,
      currentTrack,
      playbackState,
      socketConnected,
      isHost,
      loading,
      setRoom, setSongs, setPlayback, setSocketStatus, setLatency,
      setLoading, setError, setCurrentUser, setActiveNav, updateRoomUsers,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
