import { clock } from "./clock";
import { readLocal, syncStore, writeLocal } from "@/state/store";

// Sample-accurate synced playback for library tracks.
//
// The whole file is decoded into an AudioBuffer and started with
// AudioBufferSourceNode.start(when, offset), which the audio thread honours
// to the sample. `when` comes from mapping the server's scheduled instant
// onto the AudioContext timeline via getOutputTimestamp(), so the moment the
// sound actually leaves the speaker (output latency included) lines up on
// every device — the same idea that keeps a pair of earbuds together.
//
// Afterwards a drift loop compares where the audio output IS against where
// the server clock says it SHOULD be, and corrects:
//   < DEADBAND          nothing
//   < HARD_RESYNC       inaudible ±0.3% playbackRate trim (≈5 cents)
//   >= HARD_RESYNC      crossfaded jump to the right position

const DRIFT_INTERVAL_MS = 500;
const DEADBAND_S = 0.004;
const HARD_RESYNC_S = 0.04;
const MAX_RATE_TRIM = 0.003;
const RATE_CORRECTION_WINDOW_S = 3; // close the gap over roughly this long
const MIN_START_LEAD_S = 0.06;
const FADE_S = 0.012;

// Files bigger than this are streamed through a media element instead of
// decoded (an hour of audio decodes to >1GB of PCM, enough to crash a phone).
// Streaming trades sample accuracy for ~10-30ms closed-loop correction.
const STREAM_THRESHOLD_BYTES = 40 * 1024 * 1024;
const STREAM_SEEK_THRESHOLD_S = 0.08;
const STREAM_MAX_RATE_TRIM = 0.02;

export interface EngineTarget {
  status: "idle" | "paused" | "playing";
  position: number;
  scheduleAt: number | null;
}

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  ctxT0: number; // context time at which pos0 is (was) output
  pos0: number;
  rate: number;
}

type AudioCtor = typeof AudioContext;

export class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private loadToken = 0;
  private voice: Voice | null = null;
  private target: EngineTarget | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private smoothedErr = 0;
  private lastHardResync = 0;
  private volume = 1;
  private calibrationS = 0;
  // streaming mode
  private media: HTMLAudioElement | null = null;
  private mediaNode: MediaElementAudioSourceNode | null = null;
  private streaming = false;
  private streamTimers: ReturnType<typeof setTimeout>[] = [];
  // How far past the target a streaming seek must aim to land on time
  // (media-element seeks take a device-specific 30-300ms). Learned + persisted.
  private streamSeekLead = readLocal<number>("syncwave.stream.seekLead", 0.05);
  private learnAfterSeek = false;

  /** Only the engine for the current track may write the shared sync status. */
  active = false;

  private publish(patch: Parameters<typeof syncStore.set>[0]) {
    if (this.active) syncStore.set(patch);
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor: AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "playback" });
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    ctx.onstatechange = () => {
      this.publishLock();
      if (ctx.state === "running") this.reschedule();
    };
    this.ctx = ctx;
    this.publishLock();
    return ctx;
  }

  private publishLock() {
    const locked = !!this.ctx && this.ctx.state !== "running" && this.target?.status === "playing";
    this.publish({
      needsUnlock: locked,
      outputLatencyMs: this.ctx ? Math.round(((this.ctx.outputLatency || this.ctx.baseLatency) ?? 0) * 1000) : null,
    });
  }

  /** Must run inside a user gesture on iOS/Android. */
  async unlock() {
    // iOS: route through the "playback" category so the mute switch doesn't silence us.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) {
      try {
        nav.audioSession.type = "playback";
      } catch {
        /* unsupported */
      }
    }
    const ctx = this.ensureContext();
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        /* still locked */
      }
    }
    // Some WebKit builds only fully unlock after a node actually plays.
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blip.connect(ctx.destination);
    blip.start();
    this.publishLock();
  }

  get unlocked() {
    return this.ctx?.state === "running";
  }

  async load(url: string): Promise<number> {
    const token = ++this.loadToken;
    this.stopVoice();
    this.stopStream();
    this.buffer = null;
    this.streaming = false;
    const ctx = this.ensureContext();

    let size = 0;
    try {
      const head = await fetch(url, { method: "HEAD" });
      size = Number(head.headers.get("content-length")) || 0;
    } catch {
      /* fall through to a normal fetch, which will report the real error */
    }
    if (token !== this.loadToken) throw new Error("superseded");

    if (size > STREAM_THRESHOLD_BYTES) {
      const duration = await this.loadStream(url, token);
      this.streaming = true;
      this.reschedule();
      return duration;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Audio request failed (${res.status})`);
    const data = await res.arrayBuffer();
    if (token !== this.loadToken) throw new Error("superseded");
    const buffer = await new Promise<AudioBuffer>((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
    if (token !== this.loadToken) throw new Error("superseded");
    this.buffer = buffer;
    this.reschedule();
    return buffer.duration;
  }

  private loadStream(url: string, token: number): Promise<number> {
    const ctx = this.ensureContext();
    if (!this.media) {
      const media = new Audio();
      media.crossOrigin = "anonymous";
      media.preload = "auto";
      (media as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
      this.media = media;
      // Route through the context so volume/unlock behave the same as buffer mode.
      this.mediaNode = ctx.createMediaElementSource(media);
      this.mediaNode.connect(this.master!);
    }
    const media = this.media;
    media.src = url;
    media.load();
    return new Promise((resolve, reject) => {
      const done = () => {
        media.removeEventListener("canplay", done);
        media.removeEventListener("error", fail);
        if (token !== this.loadToken) reject(new Error("superseded"));
        else resolve(media.duration);
      };
      const fail = () => {
        media.removeEventListener("canplay", done);
        media.removeEventListener("error", fail);
        reject(new Error("Audio failed to load"));
      };
      media.addEventListener("canplay", done);
      media.addEventListener("error", fail);
    });
  }

  private stopStream() {
    this.streamTimers.forEach(clearTimeout);
    this.streamTimers = [];
    if (this.media && !this.media.paused) this.media.pause();
  }

  private get outputLatencyS(): number {
    return this.ctx ? ((this.ctx.outputLatency || this.ctx.baseLatency) ?? 0) : 0;
  }

  /** Streaming-mode equivalent of reschedule(). */
  private rescheduleStream() {
    const media = this.media!;
    const target = this.target!;
    this.streamTimers.forEach(clearTimeout);
    this.streamTimers = [];

    if (target.status !== "playing" || target.scheduleAt === null) {
      this.stopDriftLoop();
      const at = target.scheduleAt !== null ? clock.toLocal(target.scheduleAt) - this.calibrationS * 1000 - performance.now() : 0;
      const apply = () => {
        media.pause();
        media.playbackRate = 1;
        media.currentTime = target.position;
      };
      if (at > 0) this.streamTimers.push(setTimeout(apply, at));
      else apply();
      this.publish({ status: "ready", driftMs: null });
      return;
    }

    // Local time at which `position` must be audible, minus the output path delay.
    const startPerf = clock.toLocal(target.scheduleAt) - this.calibrationS * 1000 - this.outputLatencyS * 1000;
    const lead = startPerf - performance.now();
    media.playbackRate = 1;
    if (lead > 30) {
      media.pause();
      media.currentTime = target.position;
      this.streamTimers.push(setTimeout(() => void media.play().catch(() => this.publishLock()), lead - 10));
    } else {
      media.currentTime = target.position - lead / 1000 + this.streamSeekLead;
      this.learnAfterSeek = true;
      void media.play().catch(() => this.publishLock());
    }
    this.publish({ status: "syncing" });
    this.startDriftLoop();
  }

  private checkStreamDrift() {
    const media = this.media;
    const target = this.target;
    if (!media || !target || target.status !== "playing" || media.paused || media.seeking) return;
    const now = performance.now();
    const audible = media.currentTime - this.outputLatencyS;
    const err = audible - this.expectedPosition(now);
    if (this.expectedPosition(now) < 0) return;

    if (this.learnAfterSeek) {
      // First reading after a seek: if we landed late (err < 0) aim further ahead next time.
      this.learnAfterSeek = false;
      if (Math.abs(err) < 0.6) {
        this.streamSeekLead = Math.max(0, Math.min(0.6, this.streamSeekLead - err * 0.6));
        writeLocal("syncwave.stream.seekLead", this.streamSeekLead);
      }
      this.smoothedErr = 0;
    }
    this.smoothedErr = this.smoothedErr === 0 ? err : this.smoothedErr * 0.6 + err * 0.4;
    const e = this.smoothedErr;

    if (Math.abs(err) > STREAM_SEEK_THRESHOLD_S && now - this.lastHardResync > 1500) {
      this.lastHardResync = now;
      media.playbackRate = 1;
      media.currentTime = this.expectedPosition(now) + this.outputLatencyS + this.streamSeekLead;
      this.learnAfterSeek = true;
      this.smoothedErr = 0;
      return;
    }
    media.playbackRate = Math.abs(e) < 0.008 ? 1 : 1 + Math.max(-STREAM_MAX_RATE_TRIM, Math.min(STREAM_MAX_RATE_TRIM, -e / 1.5));
    this.publish({ driftMs: Math.round(e * 1000), status: Math.abs(e) < 0.025 ? "locked" : "syncing" });
  }

  setTarget(target: EngineTarget) {
    this.target = target;
    this.publishLock();
    this.reschedule();
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.03);
  }

  setCalibration(ms: number) {
    const changed = Math.abs(ms / 1000 - this.calibrationS) > 0.0005;
    this.calibrationS = ms / 1000;
    if (changed) this.reschedule();
  }

  /** Force a fresh start at the correct position (e.g. after resuming from background). */
  resync() {
    this.reschedule();
  }

  destroy() {
    this.loadToken++;
    this.stopVoice();
    this.stopStream();
    this.stopDriftLoop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.buffer = null;
    this.publish({ needsUnlock: false });
  }

  // --- clock mapping -------------------------------------------------------

  /** Context time whose sample reaches the speaker at local performance time `perfMs`. */
  private ctxTimeAt(perfMs: number): number {
    const ctx = this.ctx!;
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    }
    const outputLatency = (ctx.outputLatency || ctx.baseLatency) ?? 0;
    return ctx.currentTime + (perfMs - performance.now()) / 1000 - outputLatency;
  }

  /** Track position that should be audible right now according to the server clock. */
  private expectedPosition(perfMs: number): number {
    const t = this.target!;
    const startPerf = clock.toLocal(t.scheduleAt!);
    return t.position + (perfMs + this.calibrationS * 1000 - startPerf) / 1000;
  }

  // --- voices ----------------------------------------------------------------

  private startVoice(when: number, offset: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + FADE_S);
    src.connect(gain).connect(this.master!);
    src.start(when, offset);
    this.voice = { src, gain, ctxT0: when, pos0: offset, rate: 1 };
    this.smoothedErr = 0;
  }

  private stopVoice(at?: number) {
    const voice = this.voice;
    if (!voice || !this.ctx) return;
    this.voice = null;
    const t = Math.max(at ?? 0, this.ctx.currentTime);
    try {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
      voice.gain.gain.linearRampToValueAtTime(0, t + FADE_S);
      voice.src.stop(t + FADE_S + 0.01);
    } catch {
      /* already stopped */
    }
  }

  private reschedule() {
    const ctx = this.ctx;
    const target = this.target;
    if (!ctx || !target) return;
    if (this.streaming && this.media) {
      this.rescheduleStream();
      return;
    }

    if (target.status !== "playing" || target.scheduleAt === null) {
      this.stopDriftLoop();
      // A scheduled pause: stop at exactly the shared instant, not on receipt.
      const at = target.scheduleAt !== null ? this.ctxTimeAt(clock.toLocal(target.scheduleAt) - this.calibrationS * 1000) : undefined;
      this.stopVoice(at);
      this.publish({ status: this.buffer ? "ready" : "loading", driftMs: null });
      return;
    }

    if (!this.buffer) {
      this.publish({ status: "loading" });
      return;
    }

    // Crossfade: old voice fades out while the new one fades in.
    this.stopVoice();

    const startPerf = clock.toLocal(target.scheduleAt) - this.calibrationS * 1000;
    let when = this.ctxTimeAt(startPerf);
    let offset = target.position;
    const earliest = ctx.currentTime + MIN_START_LEAD_S;
    if (when < earliest) {
      // Joining mid-song (or late): start slightly ahead, at the matching offset.
      offset += earliest - when;
      when = earliest;
    }
    if (offset >= this.buffer.duration) {
      this.publish({ status: "ready" });
      return;
    }

    this.startVoice(when, offset);
    this.publish({ status: "syncing" });
    this.startDriftLoop();
  }

  // --- drift correction ------------------------------------------------------

  private startDriftLoop() {
    if (!this.timer) {
      this.timer = setInterval(() => (this.streaming ? this.checkStreamDrift() : this.checkDrift()), DRIFT_INTERVAL_MS);
    }
  }

  private stopDriftLoop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private setRate(rate: number) {
    const voice = this.voice;
    const ctx = this.ctx;
    if (!voice || !ctx || Math.abs(rate - voice.rate) < 0.00005) return;
    const t = ctx.currentTime;
    if (t > voice.ctxT0) {
      voice.pos0 += (t - voice.ctxT0) * voice.rate;
      voice.ctxT0 = t;
    }
    voice.rate = rate;
    voice.src.playbackRate.setValueAtTime(rate, Math.max(t, voice.ctxT0));
  }

  private checkDrift() {
    const voice = this.voice;
    const ctx = this.ctx;
    const target = this.target;
    if (!voice || !ctx || !target || target.status !== "playing" || ctx.state !== "running") return;

    const now = performance.now();
    const outNow = this.ctxTimeAt(now);
    if (outNow < voice.ctxT0) return; // not audible yet

    const actual = voice.pos0 + (outNow - voice.ctxT0) * voice.rate;
    const err = actual - this.expectedPosition(now); // + = ahead
    this.smoothedErr = this.smoothedErr === 0 ? err : this.smoothedErr * 0.6 + err * 0.4;
    const e = this.smoothedErr;

    if (Math.abs(err) >= HARD_RESYNC_S && now - this.lastHardResync > 2000) {
      this.lastHardResync = now;
      console.log(`[WebAudio] hard resync, drift ${(err * 1000).toFixed(1)}ms`);
      this.reschedule();
      return;
    }

    if (Math.abs(e) < DEADBAND_S) {
      this.setRate(1);
    } else {
      const trim = Math.max(-MAX_RATE_TRIM, Math.min(MAX_RATE_TRIM, -e / RATE_CORRECTION_WINDOW_S));
      this.setRate(1 + trim);
    }

    this.publish({
      driftMs: Math.round(e * 10000) / 10,
      status: Math.abs(e) < 0.015 ? "locked" : "syncing",
    });
  }
}
