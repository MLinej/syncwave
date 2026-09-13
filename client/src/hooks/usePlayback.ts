import { useCallback } from "react";
import { useApp } from "@/context/AppContext";
import * as api from "@/services/api";

// Local position ticking and the duplicate HTTP+socket write path were
// removed: they raced the scheduled 'playback-state-updated' broadcast from
// the server. GlobalAudio now owns `playback.position` (ticked from the
// actual <audio> element each second), and play/pause/seek here only emit —
// the server broadcast is the single source of truth for isPlaying/position.
export function usePlayback() {
  const { playback, setPlayback, setError, room } = useApp();

  const select = useCallback(async (songId: string) => {
    try {
      await api.selectSong(songId, room?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Select failed");
    }
  }, [room?.id, setError]);

  const play = useCallback(() => {
    try {
      api.playSong(room?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    }
  }, [room?.id, setError]);

  const pause = useCallback(() => {
    try {
      api.pauseSong(room?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed");
    }
  }, [room?.id, setError]);

  const seek = useCallback((position: number) => {
    try {
      api.seekSong(position, room?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seek failed");
    }
  }, [room?.id, setError]);

  const setVolume = useCallback((volume: number) => {
    setPlayback({ volume: Math.max(0, Math.min(1, volume)) });
  }, [setPlayback]);

  return { playback, select, play, pause, seek, setVolume };
}
