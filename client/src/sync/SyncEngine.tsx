import { useEffect, useMemo } from "react";
import { appStore, syncStore, toast, useStore } from "@/state/store";
import { useIsHost } from "@/state/selectors";
import { BACKEND_URL } from "@/config";
import * as room from "@/services/room";
import { unlockAudio, webAudio, youtube } from "./engines";
import { useYouTubeDock } from "./hooks";
import type { EngineTarget } from "./webAudioEngine";

const IDLE: EngineTarget = { status: "idle", position: 0, scheduleAt: null };

/** Glue between room state and the audio engines. Renders nothing itself. */
export default function SyncEngine() {
  const current = useStore(appStore, (s) => s.room?.current ?? null);
  const playback = useStore(appStore, (s) => s.room?.playback);
  const isHost = useIsHost();
  const volume = useStore(syncStore, (s) => s.volume);
  const calibrationMs = useStore(syncStore, (s) => s.calibrationMs);

  const uid = current?.uid ?? null;
  const source = current?.track.source ?? null;

  useYouTubeDock(source === "youtube");

  // Before anything else reacts to the new track, hand status ownership over.
  webAudio.active = source === "library";
  youtube.active = source === "youtube";

  // --- load the current track on the right engine ---------------------------
  useEffect(() => {
    if (!current) {
      webAudio.setTarget(IDLE);
      youtube.setTarget(IDLE);
      syncStore.set({ engine: null, status: "idle", driftMs: null, errorMessage: null });
      return;
    }
    const { track } = current;
    syncStore.set({ engine: track.source === "youtube" ? "youtube" : "webaudio", status: "loading", driftMs: null, errorMessage: null });

    let cancelled = false;
    const fail = (message: string) => {
      if (cancelled) return;
      syncStore.set({ status: "error", errorMessage: message, needsVideoTap: false });
      room.reportTrackError(current.uid);
      toast(message, "error");
    };

    if (track.source === "youtube" && track.videoId) {
      webAudio.setTarget(IDLE);
      youtube.onError = fail;
      youtube
        .load(track.videoId)
        .then((duration) => !cancelled && room.reportTrackReady(current.uid, duration))
        .catch((err: Error) => fail(err.message || "Couldn't load this YouTube video"));
    } else if (track.url) {
      youtube.setTarget(IDLE);
      webAudio
        .load(`${BACKEND_URL}${track.url}`)
        .then((duration) => !cancelled && room.reportTrackReady(current.uid, duration))
        .catch((err: Error) => err.message !== "superseded" && fail("Couldn't load this song on your device"));
    }
    return () => {
      cancelled = true;
    };
    // Reload only when the queue item itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // --- push schedule changes ------------------------------------------------
  const target = useMemo<EngineTarget>(
    () =>
      playback && playback.trackUid === uid
        ? { status: playback.status, position: playback.position, scheduleAt: playback.scheduleAt }
        : IDLE,
    // Only the scheduling fields matter; ignore unrelated snapshot churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, playback?.trackUid, playback?.status, playback?.position, playback?.scheduleAt],
  );

  useEffect(() => {
    if (source === "youtube") youtube.setTarget(target);
    else if (source === "library") webAudio.setTarget(target);
  }, [target, source]);

  useEffect(() => {
    webAudio.setVolume(volume);
    youtube.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    webAudio.setCalibration(calibrationMs);
    youtube.setCalibration(calibrationMs);
  }, [calibrationMs]);

  // --- mobile plumbing -------------------------------------------------------
  // Any tap anywhere unlocks audio output.
  useEffect(() => {
    const onGesture = () => unlockAudio();
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      // Leaving the room: go silent.
      webAudio.setTarget(IDLE);
      youtube.setTarget(IDLE);
    };
  }, []);

  // Coming back from the background: snap straight back into sync.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Give the clock burst a moment before re-anchoring.
      setTimeout(() => {
        webAudio.resync();
        youtube.resync();
      }, 600);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Keep the screen awake while music plays (phones kill audio when they sleep).
  const playing = playback?.status === "playing";
  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (disposed) void l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [playing]);

  // Lock-screen / notification controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!current) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: current.track.title,
      artist: current.track.artist,
      album: "SyncWave",
      artwork: current.track.thumbnail ? [{ src: current.track.thumbnail, sizes: "320x180", type: "image/jpeg" }] : [],
    });
    ms.playbackState = playing ? "playing" : "paused";
    const handlers: [MediaSessionAction, (() => void) | null][] = [
      ["play", isHost ? room.play : null],
      ["pause", isHost ? room.pause : null],
      ["nexttrack", isHost ? room.next : null],
    ];
    handlers.forEach(([action, fn]) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    });
  }, [current, playing, isHost]);

  return null;
}
