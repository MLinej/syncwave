import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import * as api from "@/services/api";
import { getSocket } from "@/services/socket";
import { BACKEND_URL } from "@/config";

// --- Start-moment tuning -------------------------------------------------
// Not quite zero: a tab rendering *some* audio is treated as "playing audio"
// by the browser, which keeps it out of the harshest background throttling.
// Inaudible either way.
const SILENT_VOLUME = 0.0001;
const FINE_TUNE_LEAD_MS = 30; // final position trim this long before the target
const START_POSITION_TOLERANCE_S = 0.02; // position error we accept at the start moment
const WARMUP_MS = 180; // silent warm-up play before holding at the start position
const PLAY_CALL_COMPENSATION_MS = 12; // play() has startup cost, so call it this early
// Positive = this device starts LATER. Raise it on a device with extra output
// latency (Bluetooth speakers/headphones typically add 120-250ms).
const OUTPUT_LATENCY_COMPENSATION_MS = 0;

// --- Drift correction tuning --------------------------------------------
// Under IGNORE: do nothing. Between IGNORE and HARD_SEEK: nudge playbackRate
// for an inaudible correction. Above HARD_SEEK: snap straight to position.
const DRIFT_CHECK_INTERVAL_MS = 1000;
const DRIFT_IGNORE_THRESHOLD_S = 0.05;
const DRIFT_HARD_SEEK_THRESHOLD_S = 0.3;
const DRIFT_NUDGE_RATE_SLOW = 0.98; // used when we're ahead of expected (slow down)
const DRIFT_NUDGE_RATE_FAST = 1.02; // used when we're behind expected (speed up)

/**
 * setTimeout that re-checks as it approaches the deadline instead of trusting
 * a single long timer. Lands within ~1-2ms in a foreground tab.
 */
function scheduleAtLocal(callback: () => void, localTime: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;

  const tick = () => {
    if (cancelled) return;
    const remaining = localTime - Date.now();
    if (remaining <= 1) {
      callback();
      return;
    }
    timer = setTimeout(tick, remaining > 40 ? remaining - 30 : 1);
  };

  tick();
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

export default function GlobalAudio() {
  const { currentTrack, playbackState, clockOffsetMs, isHost, roomCode, setPlayback } = useApp();
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSrcRef = useRef<string>("");

  const cancelsRef = useRef<Array<() => void>>([]);
  const startedRef = useRef(false);
  // Playback volume is the product of the user's volume and this sync gate,
  // so the two never fight over audio.volume.
  const userVolumeRef = useRef(playbackState.volume);
  const gateOpenRef = useRef(true);
  const [audioLocked, setAudioLocked] = useState(true);
  const audioLockedRef = useRef(true);

  const applyVolume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = false;
    audio.volume = gateOpenRef.current ? userVolumeRef.current : SILENT_VOLUME;
  }, []);

  const setGate = useCallback((open: boolean) => {
    gateOpenRef.current = open;
    applyVolume();
  }, [applyVolume]);

  const clearSchedule = useCallback(() => {
    cancelsRef.current.forEach((cancel) => cancel());
    cancelsRef.current = [];
  }, []);

  // Browsers block programmatic play() until the user has interacted with the
  // page. The host gets that for free by clicking Play — guests never do,
  // which is why guest audio started late (or not at all).
  const unlockAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      const wasOpen = gateOpenRef.current;
      setGate(false);
      try {
        await audio.play();
        audio.pause();
        audioLockedRef.current = false;
        setAudioLocked(false);
        console.log("[AudioUnlock] element primed — programmatic play() is now allowed");
      } catch {
        /* still locked; the pill stays up */
      }
      setGate(wasOpen);
    } else {
      audioLockedRef.current = false;
      setAudioLocked(false);
    }
  }, [setGate]);

  useEffect(() => {
    const onGesture = () => {
      if (audioLockedRef.current) void unlockAudio();
    };
    void unlockAudio();

    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchend", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchend", onGesture);
    };
  }, [unlockAudio]);

  // Sync volume
  useEffect(() => {
    userVolumeRef.current = playbackState.volume;
    applyVolume();
  }, [playbackState.volume, applyVolume]);

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

  // --- SCHEDULER -------------------------------------------------------
  // Strategy: get the element PLAYING (silently) before the target instant so
  // that the autoplay handshake, decoder spin-up and buffering all finish
  // beforehand. At the target itself the only work is a volume change.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    clearSchedule();
    startedRef.current = false;

    const { status, scheduleAt, anchorPosition } = playbackState;
    const localTarget = scheduleAt !== null
      ? scheduleAt - clockOffsetMs + OUTPUT_LATENCY_COMPENSATION_MS
      : Date.now();
    const lead = localTarget - Date.now();

    // ---------------- PAUSE / STOP ----------------
    if (status !== "playing") {
      const applyStop = () => {
        audio.pause();
        audio.currentTime = anchorPosition;
        audio.playbackRate = 1;
        setGate(true);
        console.log(`[Scheduler] ${status.toUpperCase()} at ${anchorPosition.toFixed(3)}s (t=${Date.now()})`);
      };

      if (scheduleAt === null || lead <= 0) {
        applyStop();
      } else {
        cancelsRef.current.push(scheduleAtLocal(applyStop, localTarget));
        console.log(`[Scheduler] ${status} scheduled in ${lead.toFixed(0)}ms`);
      }
      return clearSchedule;
    }

    // ---------------- PLAY ----------------
    if (audioLockedRef.current) {
      console.warn("[AudioUnlock] playback scheduled but audio is still locked on this device — tap the screen once");
    }

    // Already past the target (late joiner / slow client): catch up and play now.
    if (scheduleAt === null || lead <= 0) {
      const caughtUp = anchorPosition + Math.max(0, -lead) / 1000;
      audio.currentTime = caughtUp;
      audio.playbackRate = 1;
      setGate(true);
      void audio.play().catch((err) => console.warn("[Scheduler] play() failed:", err.message));
      startedRef.current = true;
      console.log(`[Scheduler] target already passed by ${(-lead).toFixed(0)}ms — playing from ${caughtUp.toFixed(3)}s`);
      return clearSchedule;
    }

    const leadSeconds = lead / 1000;
    const canFreeRun = anchorPosition - leadSeconds >= 0;

    setGate(false);
    audio.playbackRate = 1;

    if (canFreeRun) {
      // Mid-track start: begin playing silently from far enough back that the
      // element free-runs into exactly anchorPosition at the target. Nothing
      // time-critical happens at the target beyond opening the gate.
      audio.currentTime = anchorPosition - leadSeconds;
      void audio.play().catch((err) => {
        console.warn("[Scheduler] preroll play() failed:", err.message);
        audioLockedRef.current = true;
        setAudioLocked(true);
      });
      console.log(`[Scheduler] preroll (free-run) from ${(anchorPosition - leadSeconds).toFixed(3)}s, audible in ${lead.toFixed(0)}ms`);
    } else {
      // Near the start of the track there is nothing to free-run through, so
      // warm the decoder with a short silent play, hold at the start position,
      // and release it at the target.
      audio.currentTime = anchorPosition;
      void audio.play().catch((err) => {
        console.warn("[Scheduler] warmup play() failed:", err.message);
        audioLockedRef.current = true;
        setAudioLocked(true);
      });
      cancelsRef.current.push(
        scheduleAtLocal(() => {
          audio.pause();
          audio.currentTime = anchorPosition;
        }, Date.now() + Math.min(WARMUP_MS, Math.max(0, lead - 150)))
      );
      cancelsRef.current.push(
        scheduleAtLocal(() => {
          const late = Math.max(0, Date.now() - localTarget) / 1000;
          audio.currentTime = anchorPosition + late;
          void audio.play().catch((err) => console.warn("[Scheduler] play() failed:", err.message));
        }, localTarget - PLAY_CALL_COMPENSATION_MS)
      );
      console.log(`[Scheduler] preroll (warm-and-hold) at ${anchorPosition.toFixed(3)}s, audible in ${lead.toFixed(0)}ms`);
    }

    // Final position trim just before the target, while still silent.
    cancelsRef.current.push(
      scheduleAtLocal(() => {
        const remaining = Math.max(0, (localTarget - Date.now()) / 1000);
        const want = Math.max(0, anchorPosition - remaining);
        const error = want - audio.currentTime;
        if (Math.abs(error) > START_POSITION_TOLERANCE_S) {
          audio.currentTime = want;
          console.log(`[Scheduler] pre-start trim ${(error * 1000).toFixed(0)}ms -> ${want.toFixed(3)}s`);
        }
      }, localTarget - FINE_TUNE_LEAD_MS)
    );

    // The audible start.
    cancelsRef.current.push(
      scheduleAtLocal(() => {
        setGate(true);
        startedRef.current = true;
        if (audio.paused) void audio.play().catch(() => {});

        const expected = anchorPosition + (Date.now() - localTarget) / 1000;
        const error = (audio.currentTime - expected) * 1000;
        console.log(
          `[Scheduler] START serverTime=${(Date.now() + clockOffsetMs).toFixed(0)} ` +
          `pos=${audio.currentTime.toFixed(3)}s expected=${expected.toFixed(3)}s error=${error.toFixed(0)}ms`
        );
      }, localTarget)
    );

    return clearSchedule;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackState.status, playbackState.scheduleAt, playbackState.anchorPosition, clockOffsetMs, currentTrack?.url, clearSchedule, setGate]);

  // --- CONTINUOUS DRIFT CORRECTION ------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playbackState.status !== "playing" || playbackState.scheduleAt === null) return;

    const localTarget = playbackState.scheduleAt - clockOffsetMs + OUTPUT_LATENCY_COMPENSATION_MS;
    const anchorPosition = playbackState.anchorPosition;

    const interval = setInterval(() => {
      // Don't fight the scheduler while it is still pre-rolling silently.
      if (!startedRef.current || audio.paused || !audio.src) return;

      const expected = anchorPosition + Math.max(0, (Date.now() - localTarget) / 1000);
      const drift = expected - audio.currentTime;
      const absDrift = Math.abs(drift);

      if (absDrift < DRIFT_IGNORE_THRESHOLD_S) {
        if (audio.playbackRate !== 1.0) audio.playbackRate = 1.0;
      } else if (absDrift < DRIFT_HARD_SEEK_THRESHOLD_S) {
        const rate = drift > 0 ? DRIFT_NUDGE_RATE_FAST : DRIFT_NUDGE_RATE_SLOW;
        if (audio.playbackRate !== rate) {
          audio.playbackRate = rate;
          console.log(`[DriftCorrection] nudge playbackRate=${rate} drift=${(drift * 1000).toFixed(0)}ms`);
        }
      } else {
        audio.playbackRate = 1.0;
        audio.currentTime = expected;
        console.log(`[DriftCorrection] hard seek — drift=${(drift * 1000).toFixed(0)}ms -> ${expected.toFixed(3)}s`);
      }

      setPlayback({ position: audio.currentTime });
    }, DRIFT_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      audio.playbackRate = 1.0;
    };
  }, [playbackState.status, playbackState.scheduleAt, playbackState.anchorPosition, clockOffsetMs, setPlayback]);

  const handleEnded = () => {
    if (isHost && roomCode) {
      api.stopSong(roomCode);
    }
  };

  // canplaythrough (not canplay) — canplay fires as soon as a fraction is
  // buffered, which let devices report "ready" and then stall on the seek.
  const handleCanPlayThrough = () => {
    console.log("[GlobalAudio] canplaythrough — emitting track-ready");
    if (roomCode && currentTrack) {
      api.emitTrackReady(roomCode, currentTrack.id);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && currentTrack && Number.isFinite(audio.duration) && audio.duration > 0 && currentTrack.duration !== audio.duration) {
      setPlayback({ currentSong: { ...currentTrack, duration: audio.duration } });
    }
  };

  const handleError = () => {
    console.error("[GlobalAudio] Audio load error for:", audioRef.current?.src);
    if (roomCode && currentTrack) {
      getSocket().emit("track-error", { roomCode, trackId: currentTrack.id });
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        onEnded={handleEnded}
        onCanPlayThrough={handleCanPlayThrough}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
        style={{ display: "none" }}
      />

      {audioLocked && currentTrack && (
        <button
          onClick={() => void unlockAudio()}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] backdrop-blur-[20px] bg-[rgba(255,179,174,0.15)] border border-[rgba(255,179,174,0.4)] text-[#ffb3ae] text-[12px] font-bold font-[Inter,sans-serif] px-4 py-2 rounded-full"
        >
          Tap to enable synced audio
        </button>
      )}
    </>
  );
}
