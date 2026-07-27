import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import * as api from "@/services/api";
import { getSocket } from "@/services/socket";

const BACKEND_URL = "http://10.10.10.164:3000";

export default function GlobalAudio() {
  const { currentTrack, playbackState, isHost, roomCode, setPlayback } = useApp();
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSrcRef = useRef<string>("");
  
  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playbackState.volume;
    }
  }, [playbackState.volume]);

  // Sync src when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const trackUrl = currentTrack?.url;
    if (!trackUrl) return;

    const fullUrl = `${BACKEND_URL}${trackUrl}`;
    
    if (lastSrcRef.current !== fullUrl) {
      console.log("[GlobalAudio] Loading new track:", fullUrl);
      lastSrcRef.current = fullUrl;
      audio.src = fullUrl;
      audio.load();
    }
  }, [currentTrack?.url]);

  // Sync play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (playbackState.isPlaying) {
      audio.play().catch((err) => {
        console.warn("[GlobalAudio] Play failed:", err.message);
      });
    } else {
      audio.pause();
    }
  }, [playbackState.isPlaying]);

  // Sync position (drift correction)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (playbackState.isPlaying) {
      const diff = Math.abs(audio.currentTime - playbackState.position);
      if (diff > 0.6) {
        console.log("[GlobalAudio] Drift correction:", diff.toFixed(2), "s");
        audio.currentTime = playbackState.position;
      }
    } else {
      if (Math.abs(audio.currentTime - playbackState.position) > 0.1) {
        audio.currentTime = playbackState.position;
      }
    }
  }, [playbackState.position, playbackState.isPlaying]);

  const handleEnded = () => {
    if (isHost && roomCode) {
      api.stopSong(roomCode);
    }
  };

  const handleCanPlay = () => {
    console.log("[GlobalAudio] canplay fired, emitting track-ready");
    if (roomCode && currentTrack) {
      api.emitTrackReady(roomCode, currentTrack.id);
    }
  };

  const handleError = () => {
    console.error("[GlobalAudio] Audio load error for:", audioRef.current?.src);
    if (roomCode && currentTrack) {
      getSocket().emit("track-error", { roomCode, trackId: currentTrack.id });
    }
  };

  return (
    <audio 
      ref={audioRef} 
      onEnded={handleEnded} 
      onCanPlay={handleCanPlay}
      onError={handleError}
      style={{ display: "none" }} 
    />
  );
}
