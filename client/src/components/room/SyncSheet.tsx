import Sheet from "@/components/ui/Sheet";
import Slider from "@/components/ui/Slider";
import { setCalibration, syncStore, useStore } from "@/state/store";
import { clock } from "@/sync/clock";
import { webAudio, youtube } from "@/sync/engines";
import { RestartIcon } from "@/components/ui/Icons";
import { SyncDot, useSyncStatus } from "./Header";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-white/[0.04] px-4 py-3">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const PRESETS = [
  { label: "Phone speaker", value: 0 },
  { label: "Bluetooth headphones", value: 150 },
  { label: "Bluetooth speaker", value: 220 },
];

const RANGE = 300;

export default function SyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore(syncStore, (x) => x);
  const status = useSyncStatus();

  const resync = () => {
    clock.resync();
    setTimeout(() => {
      webAudio.resync();
      youtube.resync();
    }, 700);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Sync & audio">
      <div className="flex items-center gap-4 rounded-[16px] border border-line bg-white/[0.04] p-4">
        <SyncDot tone={status.tone} />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold">{status.text}</div>
          <div className="text-sm text-muted">
            {s.engine === "youtube"
              ? "YouTube player · continuous correction"
              : s.engine === "webaudio"
                ? "Room library · sample-accurate playback"
                : "No song loaded"}
          </div>
        </div>
        <button className="btn btn-secondary min-h-10 px-3 text-sm" onClick={resync}>
          <RestartIcon size={16} /> Re-sync
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Stat label="Drift" value={s.driftMs === null ? "—" : `${s.driftMs > 0 ? "+" : ""}${s.driftMs}ms`} />
        <Stat label="Network" value={s.clockReady ? `${s.rttMs.toFixed(0)}ms` : "…"} />
        <Stat label="Output" value={s.outputLatencyMs === null ? "—" : `${s.outputLatencyMs}ms`} />
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-semibold">Device delay</span>
          <span className="text-base font-semibold text-accent tabular-nums">
            {s.calibrationMs > 0 ? "+" : ""}
            {s.calibrationMs}ms
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Bluetooth headphones and speakers add a delay the browser can't see. If this device sounds behind the others, slide right until it
          lines up. If it's ahead, slide left.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button className="btn btn-secondary min-h-10 w-12 px-0 text-sm" onClick={() => setCalibration(s.calibrationMs - 10)} aria-label="Decrease by 10ms">
            −10
          </button>
          <Slider
            className="flex-1"
            value={s.calibrationMs + RANGE}
            max={RANGE * 2}
            step={5}
            onChange={(v) => setCalibration(Math.round((v - RANGE) / 5) * 5)}
            onCommit={(v) => setCalibration(Math.round((v - RANGE) / 5) * 5)}
            format={(v) => `${Math.round(v - RANGE)}ms`}
            ariaLabel="Device delay compensation"
            ariaValueText={`${s.calibrationMs} milliseconds`}
          />
          <button className="btn btn-secondary min-h-10 w-12 px-0 text-sm" onClick={() => setCalibration(s.calibrationMs + 10)} aria-label="Increase by 10ms">
            +10
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={`chip ${s.calibrationMs === p.value ? "border-accent/60 bg-accent/15 text-accent" : ""}`}
              onClick={() => setCalibration(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
