import { useSyncExternalStore } from "react";
import type { RoomState, Session } from "@/types";

// Minimal external store: the socket layer and the audio engines write from
// outside React, components subscribe with a selector.
export function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

type Store<T extends object> = ReturnType<typeof createStore<T>>;

export function useStore<T extends object, S>(store: Store<T>, selector: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

// --- persistence helpers -------------------------------------------------
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — non-essential */
  }
}

function getClientId(): string {
  let id = readLocal<string | null>("syncwave.clientId", null);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
    writeLocal("syncwave.clientId", id);
  }
  return id;
}

// Secret per-browser id: sent only to the server (as a reconnect credential),
// never compared against or shown alongside other members' public ids.
export const CLIENT_ID = getClientId();

// --- app state -----------------------------------------------------------
export type Connection = "connecting" | "online" | "offline";

export const appStore = createStore({
  connection: "connecting" as Connection,
  session: readLocal<Session | null>("syncwave.session", null),
  room: null as RoomState | null,
  /** This device's public member id in the current room (from the join reply). */
  me: null as string | null,
  joining: false,
  youtubeSearch: false,
});

// --- sync / audio state ----------------------------------------------------
export type EngineStatus = "idle" | "loading" | "ready" | "syncing" | "locked" | "error";

export const syncStore = createStore({
  clockReady: false,
  offsetMs: 0,
  rttMs: 0,
  engine: null as "webaudio" | "youtube" | null,
  status: "idle" as EngineStatus,
  driftMs: null as number | null,
  outputLatencyMs: null as number | null,
  needsUnlock: false, // web audio context suspended: needs a tap
  needsVideoTap: false, // youtube embed blocked by autoplay policy: tap the video
  errorMessage: null as string | null, // why the current track can't play on this device
  volume: readLocal<number>("syncwave.volume", 0.9),
  calibrationMs: readLocal<number>("syncwave.calibrationMs", 0),
});

export function setVolume(volume: number) {
  const v = Math.max(0, Math.min(1, volume));
  syncStore.set({ volume: v });
  writeLocal("syncwave.volume", v);
}

export function setCalibration(ms: number) {
  const v = Math.round(Math.max(-500, Math.min(500, ms)));
  syncStore.set({ calibrationMs: v });
  writeLocal("syncwave.calibrationMs", v);
}

// --- toasts ----------------------------------------------------------------
export interface ToastItem {
  id: number;
  message: string;
  kind: "info" | "error" | "success";
}

export const toastStore = createStore({ toasts: [] as ToastItem[] });
let toastSeq = 0;

export function toast(message: string, kind: ToastItem["kind"] = "info") {
  const id = ++toastSeq;
  toastStore.set((s) => ({ toasts: [...s.toasts.filter((t) => t.message !== message), { id, message, kind }].slice(-3) }));
  setTimeout(() => dismissToast(id), kind === "error" ? 4500 : 3000);
}

export function dismissToast(id: number) {
  toastStore.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
