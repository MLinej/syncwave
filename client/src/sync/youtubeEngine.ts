import { clock } from "./clock";
import { readLocal, syncStore, writeLocal } from "@/state/store";
import type { EngineTarget } from "./webAudioEngine";
import { hostnameUrlFor, isIpHost } from "@/utils/hostRedirect";

// Synced playback for YouTube tracks through the official IFrame Player API.
//
// The embed is a black box: play() and seekTo() take a variable, unknown
// time to take effect. So instead of trusting a single scheduled call, the
// engine runs a closed loop against the server clock:
//   1. start slightly early (learned start latency), muted;
//   2. measure position error every tick; seek with a learned seek latency
//      until the error is inside the lock window;
//   3. unmute once locked, then keep watching with a wider window so tiny
//      jitter doesn't cause audible re-seeks.
// Both latencies are learned per device and persisted.

interface YTPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  cueVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: object) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

const TICK_MS = 200;
const LOCK_ENTER_S = 0.045; // must get this close before unmuting
const LOCK_EXIT_S = 0.13; // once locked, only re-seek beyond this
const SEEK_COOLDOWN_MS = 900;
const MAX_MUTED_SYNC_MS = 3500; // never stay silent longer than this
const BLOCKED_AFTER_MS = 1800; // play() ignored this long => autoplay blocked
// Once locked, small errors are slewed away with a pitch-preserving tempo
// trim instead of audible re-seeks. The embed snaps rates to 0.05 steps, so
// this is a hysteresis controller: run at ±5% until the error is gone.
const RATE_TRIM = 0.05;
const RATE_START_S = 0.025;
const RATE_STOP_S = 0.008;

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Could not load the YouTube player"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export class YouTubeEngine {
  private player: YTPlayer | null = null;
  private playerReady: Promise<void> | null = null;
  private host: HTMLElement;
  private videoId: string | null = null;
  private target: EngineTarget | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private loadToken = 0;
  private volume = 1;
  private calibrationS = 0;

  private locked = false;
  private warming = false; // muted pre-buffer play in progress — don't fight it
  private rate = 1;

  /** Only the engine for the current track may write the shared sync status. */
  active = false;

  private publish(patch: Parameters<typeof syncStore.set>[0]) {
    if (this.active) syncStore.set(patch);
  }
  private fineRate = true; // false if this platform snaps rates to the preset list
  private syncStartedAt = 0;
  private lastSeekAt = 0;
  private lastSeekTarget: number | null = null;
  private playRequestedAt = 0;
  private startLatency = readLocal<number>("syncwave.yt.startLatency", 0.25);
  private seekLatency = readLocal<number>("syncwave.yt.seekLatency", 0.2);

  constructor(host: HTMLElement) {
    this.host = host;
  }

  private ensurePlayer(videoId: string): Promise<void> {
    if (this.playerReady) return this.playerReady;
    this.playerReady = loadApi().then(
      (YT) =>
        new Promise<void>((resolve, reject) => {
          const mount = document.createElement("div");
          this.host.appendChild(mount);
          this.player = new YT.Player(mount, {
            videoId,
            width: "100%",
            height: "100%",
            playerVars: {
              playsinline: 1,
              controls: 0,
              disablekb: 1,
              rel: 0,
              fs: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => resolve(),
              onError: (e: { data: number }) => {
                this.fail(e.data);
                reject(new Error("player error"));
              },
              onStateChange: () => this.tick(),
            },
          });
        }),
    );
    return this.playerReady;
  }

  /** Called for errors after load() has finished (load() itself throws). */
  onError?: (message: string) => void;
  private failed: string | null = null;
  private loading = false;

  private fail(code: number) {
    let message = "YouTube couldn't play this video";
    if (code === 101 || code === 150 || code === 152 || code === 153) {
      message = isIpHost()
        ? `YouTube won't play on pages opened by IP address. Open ${hostnameUrlFor()} instead.`
        : "The owner doesn't allow this video to play outside YouTube";
    } else if (code === 100) {
      message = "This video was removed or is private";
    }
    this.failed = message;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.publish({ status: "error", needsVideoTap: false, driftMs: null });
    if (!this.loading) this.onError?.(message);
  }

  /** Loads the video and pre-buffers it silently. Resolves with its duration. */
  async load(videoId: string): Promise<number | null> {
    const token = ++this.loadToken;
    this.videoId = videoId;
    this.locked = false;
    this.fineRate = true;
    this.failed = null;
    this.loading = true;
    try {
      return await this.loadInner(videoId, token);
    } finally {
      if (token === this.loadToken) this.loading = false;
    }
  }

  private async loadInner(videoId: string, token: number): Promise<number | null> {
    this.publish({ status: "loading", driftMs: null, needsVideoTap: false });

    const fresh = !this.player;
    await this.ensurePlayer(videoId).catch(() => {});
    if (this.failed) throw new Error(this.failed);
    if (token !== this.loadToken || !this.player) return null;
    const p = this.player;
    if (!fresh) p.cueVideoById({ videoId });
    p.setVolume(this.volume * 100);

    // Warm-up: a short muted play fills the buffer and spins up the decoder,
    // so the synchronized start isn't eaten by initial buffering.
    if (!this.isPlayingTarget()) {
      this.warming = true;
      p.mute();
      p.playVideo();
      const started = await this.waitFor(
        () => p.getPlayerState() === STATE.PLAYING || this.isPlayingTarget() || !!this.failed,
        4000,
      );
      this.warming = false;
      if (this.failed) throw new Error(this.failed);
      if (token !== this.loadToken) return null;
      if (!this.isPlayingTarget()) {
        p.pauseVideo();
        p.seekTo(this.target?.position ?? 0, true);
        if (!started) this.publish({ needsVideoTap: true });
      }
    }

    if (this.failed) throw new Error(this.failed);
    this.publish({ status: "ready" });
    this.startLoop();
    const duration = p.getDuration();
    return duration > 0 ? duration : null;
  }

  private isPlayingTarget(): boolean {
    return this.target?.status === "playing";
  }

  private waitFor(cond: () => boolean, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const started = performance.now();
      const check = () => {
        if (cond()) resolve(true);
        else if (performance.now() - started > timeoutMs) resolve(false);
        else setTimeout(check, 50);
      };
      check();
    });
  }

  setTarget(target: EngineTarget) {
    const restarted =
      !this.target ||
      target.status !== this.target.status ||
      target.scheduleAt !== this.target.scheduleAt ||
      target.position !== this.target.position;
    this.target = target;
    if (restarted) {
      this.locked = false;
      this.syncStartedAt = 0;
    }
    this.tick();
    if (target.status === "idle" && this.timer) {
      // Another engine owns playback now: park the video and stop the loop.
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.player?.setVolume(volume * 100);
  }

  setCalibration(ms: number) {
    this.calibrationS = ms / 1000;
    this.locked = false;
  }

  resync() {
    this.locked = false;
    this.syncStartedAt = 0;
    this.tick();
  }

  destroy() {
    this.loadToken++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      this.player?.destroy();
    } catch {
      /* already gone */
    }
    this.player = null;
    this.playerReady = null;
    this.host.innerHTML = "";
    this.publish({ needsVideoTap: false });
  }

  private startLoop() {
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private expected(): number {
    const t = this.target!;
    return t.position + (performance.now() + this.calibrationS * 1000 - clock.toLocal(t.scheduleAt!)) / 1000;
  }

  private setRate(rate: number) {
    const p = this.player;
    if (!p || Math.abs(rate - this.rate) < 0.002) return;
    p.setPlaybackRate(rate);
    this.rate = rate;
    if (rate === 1) return;
    // The getter only updates after the iframe reports back, so verify later.
    setTimeout(() => {
      // Hidden pages get throttled status updates — only trust a visible check.
      if (this.player !== p || this.rate !== rate || document.visibilityState !== "visible") return;
      if (Math.abs(p.getPlaybackRate() - rate) > 0.001) {
        // Rate got rounded to a preset (1.25 etc.) — never use rate trims here.
        console.warn("[YouTube] fine playback rates unsupported; falling back to seeks");
        this.fineRate = false;
        p.setPlaybackRate(1);
        this.rate = 1;
      }
    }, 1500);
  }

  private persistLatencies() {
    writeLocal("syncwave.yt.startLatency", this.startLatency);
    writeLocal("syncwave.yt.seekLatency", this.seekLatency);
  }

  private tick() {
    const p = this.player;
    const t = this.target;
    if (!p || !t || !this.videoId || this.failed || typeof p.getPlayerState !== "function") return;
    const state = p.getPlayerState();
    const now = performance.now();

    // ----- paused / idle -----
    if (t.status !== "playing" || t.scheduleAt === null) {
      if (this.warming) return;
      // Scheduled pause: keep playing until the shared instant.
      if (t.scheduleAt !== null && clock.toLocal(t.scheduleAt) - this.calibrationS * 1000 > now) return;
      if (state === STATE.PLAYING || state === STATE.BUFFERING) p.pauseVideo();
      if (Math.abs(p.getCurrentTime() - t.position) > 0.25) p.seekTo(t.position, true);
      this.publish({ status: "ready", driftMs: null });
      return;
    }

    const expected = this.expected();

    // ----- before the start instant: hold, then start early by the learned latency -----
    if (expected < -this.startLatency) {
      if (state === STATE.PLAYING) p.pauseVideo();
      if (Math.abs(p.getCurrentTime() - t.position) > 0.05) p.seekTo(t.position, true);
      return;
    }

    if (state !== STATE.PLAYING && state !== STATE.BUFFERING) {
      if (!this.locked) p.mute();
      if (!this.playRequestedAt) this.playRequestedAt = now;
      if (expected > 0.3 && Math.abs(p.getCurrentTime() - expected) > 0.3) {
        p.seekTo(expected + this.startLatency, true);
      }
      p.playVideo();
      if (now - this.playRequestedAt > BLOCKED_AFTER_MS) this.publish({ needsVideoTap: true });
      return;
    }

    if (this.playRequestedAt) {
      // First tick after play() took effect: learn how long the start took.
      const err = p.getCurrentTime() - expected;
      if (expected >= 0 && expected < 2 && Math.abs(err) < 1) {
        this.startLatency = Math.max(0, Math.min(1.2, this.startLatency - err * 0.5));
        this.persistLatencies();
      }
      this.playRequestedAt = 0;
      this.publish({ needsVideoTap: false });
    }
    if (state === STATE.BUFFERING) return;

    if (!this.syncStartedAt) this.syncStartedAt = now;
    const err = p.getCurrentTime() - expected; // + = ahead

    // Learn the seek latency from the first measurement after each seek.
    if (this.lastSeekTarget !== null && now - this.lastSeekAt > 350) {
      if (Math.abs(err) < 1) {
        this.seekLatency = Math.max(0, Math.min(1.5, this.seekLatency - err * 0.6));
        this.persistLatencies();
      }
      this.lastSeekTarget = null;
    }

    const tolerance = this.locked ? LOCK_EXIT_S : LOCK_ENTER_S;
    if (Math.abs(err) > tolerance && now - this.lastSeekAt > SEEK_COOLDOWN_MS) {
      this.setRate(1);
      const to = expected + this.seekLatency;
      p.seekTo(to, true);
      this.lastSeekAt = now;
      this.lastSeekTarget = to;
      if (this.locked && Math.abs(err) > 0.5) this.locked = false;
    } else {
      if (Math.abs(err) <= LOCK_ENTER_S) this.locked = true;
      if (this.locked && this.fineRate && now - this.lastSeekAt > 400) {
        const trimming = this.rate !== 1;
        if (Math.abs(err) > RATE_START_S || (trimming && Math.abs(err) > RATE_STOP_S && Math.sign(err) === Math.sign(1 - this.rate))) {
          this.setRate(err > 0 ? 1 - RATE_TRIM : 1 + RATE_TRIM);
        } else {
          this.setRate(1);
        }
      }
    }

    const shouldUnmute = this.locked || now - this.syncStartedAt > MAX_MUTED_SYNC_MS;
    if (shouldUnmute && p.isMuted()) {
      p.unMute();
      p.setVolume(this.volume * 100);
    }

    this.publish({ driftMs: Math.round(err * 1000), status: this.locked ? "locked" : "syncing" });
  }
}
