import type { Socket } from "socket.io-client";
import { syncStore } from "@/state/store";

// NTP-style clock sync against the server's monotonic clock.
//
// Each sample measures one round trip on performance.now() (monotonic, sub-ms)
// and assumes the server stamped its time at the midpoint. Samples with the
// lowest RTT have the least room for asymmetric delay, so the estimate is
// the median offset of the fastest third of a sliding window.
const WINDOW = 24;
const BURST_SAMPLES = 12;
const BURST_GAP_MS = 40;
const STEADY_INTERVAL_MS = 2500;

interface Sample {
  offset: number;
  rtt: number;
}

class ClockSync {
  private samples: Sample[] = [];
  private socket: Socket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private burstLeft = 0;
  offset = 0; // serverTime - performance.now()
  rtt = 0;
  ready = false;

  serverNow(): number {
    return performance.now() + this.offset;
  }

  /** Server timestamp -> local performance.now() timeline. */
  toLocal(serverTime: number): number {
    return serverTime - this.offset;
  }

  start(socket: Socket) {
    this.socket = socket;
    this.resync();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.socket = null;
  }

  /** Throw away history and take a fast burst (after reconnect or wake-up). */
  resync() {
    this.samples = [];
    this.burstLeft = BURST_SAMPLES;
    this.schedule(0);
  }

  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sample(), delay);
  }

  private sample() {
    const socket = this.socket;
    if (!socket?.connected) return;
    const t0 = performance.now();
    socket.timeout(3000).emit("clock", (err: Error | null, serverTime: number) => {
      if (this.socket !== socket) return;
      if (!err && Number.isFinite(serverTime)) {
        const t1 = performance.now();
        this.add({ offset: serverTime - (t0 + t1) / 2, rtt: t1 - t0 });
      }
      if (this.burstLeft > 0) this.burstLeft -= 1;
      this.schedule(this.burstLeft > 0 ? BURST_GAP_MS : STEADY_INTERVAL_MS);
    });
  }

  private add(sample: Sample) {
    this.samples.push(sample);
    if (this.samples.length > WINDOW) this.samples.shift();

    const best = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, Math.max(3, Math.ceil(this.samples.length / 3)));
    const offsets = best.map((s) => s.offset).sort((a, b) => a - b);
    this.offset = offsets[Math.floor(offsets.length / 2)];
    this.rtt = best[0].rtt;

    if (!this.ready && this.samples.length >= 4) this.ready = true;
    syncStore.set({ clockReady: this.ready, offsetMs: this.offset, rttMs: this.rtt });
  }
}

export const clock = new ClockSync();

// performance.now() can pause while a phone sleeps, which silently breaks the
// offset — re-measure from scratch whenever the page comes back.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") clock.resync();
  });
}
