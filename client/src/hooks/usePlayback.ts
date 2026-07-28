import { useCallback, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import * as api from "@/services/api";
import { emitPlay, emitPause, emitSeek } from "@/services/socket";

export function usePlayback() {
  const { playback, setPlayback, setError, room } = useApp();
  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Advance position locally while playing
  useEffect(() => {
    if (playback.isPlaying) {
      positionTimerRef.current = setInterval(() => {
        setPlayback({ position: playback.position + 1 });
      }, 1000);
    }
    return () => {
      if (positionTimerRef.current) clearInterval(positionTimerRef.current);
    };
  }, [playback.isPlaying, playback.position, setPlayback]);

  const select = useCallback(async (songId: string) => {
    try {
      await api.selectSong(songId, room?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Select failed");
    }
  }, [room?.id, setError]);

  const play = useCallback(async () => {
    try {
      const state = await api.playSong(room?.id);
      setPlayback(state);
      emitPlay("", room?.id, 0); // legacy socket.ts
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    }
  }, [room?.id, setPlayback, setError]);

  const pause = useCallback(async () => {
    try {
      const state = await api.pauseSong(room?.id);
      setPlayback(state);
      emitPause(room?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed");
    }
  }, [setPlayback, setError]);

  const seek = useCallback(async (position: number) => {
    try {
      setPlayback({ position });
      await api.seekSong(position, room?.id);
      emitSeek(position, room?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seek failed");
    }
  }, [setPlayback, setError]);

  const setVolume = useCallback((volume: number) => {
    setPlayback({ volume: Math.max(0, Math.min(1, volume)) });
  }, [setPlayback]);

  return { playback, select, play, pause, seek, setVolume };
}
