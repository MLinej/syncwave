import { useEffect, useState } from "react";
import { appStore, useStore } from "./store";
import type { RoomState } from "@/types";

const EMPTY_ROOM: RoomState = {
  code: "",
  hostId: null,
  members: [],
  current: null,
  queue: [],
  suggestions: [],
  repeat: "off",
  hasPrevious: false,
  playback: { status: "idle", trackUid: null, position: 0, scheduleAt: null, pendingStart: false },
};

export const useRoom = () => useStore(appStore, (s) => s.room ?? EMPTY_ROOM);
export const useMe = () => useStore(appStore, (s) => s.me);
export const useIsHost = () => useStore(appStore, (s) => !!s.room && !!s.me && s.room.hostId === s.me);

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
