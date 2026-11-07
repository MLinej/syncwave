import { useState } from "react";
import { useRoom } from "@/state/selectors";
import { appStore, syncStore, toast, useStore } from "@/state/store";
import { leaveRoom } from "@/services/room";
import { copyText } from "@/utils/format";
import Avatar from "@/components/ui/Avatar";
import Sheet from "@/components/ui/Sheet";
import Tooltip from "@/components/ui/Tooltip";
import Wordmark from "@/components/ui/Wordmark";
import { CopyIcon, CrownIcon, LeaveIcon } from "@/components/ui/Icons";

type Tone = "good" | "warn" | "bad" | "idle";

export function useSyncStatus(): { text: string; short: string; tone: Tone } {
  const connection = useStore(appStore, (s) => s.connection);
  const status = useStore(syncStore, (s) => s.status);
  const drift = useStore(syncStore, (s) => s.driftMs);
  const hasTrack = useStore(appStore, (s) => !!s.room?.current);

  if (connection !== "online") return { text: "Reconnecting", short: "Offline", tone: "bad" };
  if (status === "error") return { text: "Can't play here", short: "Error", tone: "bad" };
  if (status === "locked") {
    const ms = drift === null ? null : `${Math.abs(drift).toFixed(0)}ms`;
    return { text: ms ? `In sync · ${ms}` : "In sync", short: ms ?? "Sync", tone: "good" };
  }
  if (status === "syncing" || status === "loading") return { text: "Syncing…", short: "Sync…", tone: "warn" };
  return { text: hasTrack ? "Ready" : "Connected", short: hasTrack ? "Ready" : "Live", tone: "idle" };
}

export function SyncDot({ tone }: { tone: Tone }) {
  const color = tone === "good" ? "text-ok bg-ok" : tone === "warn" ? "text-warn bg-warn" : tone === "bad" ? "text-danger bg-danger" : "text-ok/60 bg-ok/60";
  return <span className={`pulse-dot inline-block size-2 shrink-0 rounded-full ${color}`} aria-hidden="true" />;
}

export function SyncPill({ onClick }: { onClick: () => void }) {
  const s = useSyncStatus();
  return (
    <button
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-full border border-line bg-white/[0.06] px-3 text-sm font-semibold backdrop-blur-xl transition hover:bg-white/[0.1]"
      aria-label={`Sync status: ${s.text}. Open sync settings`}
    >
      <SyncDot tone={s.tone} />
      <span className="hidden sm:inline">{s.text}</span>
      <span className="sm:hidden">{s.short}</span>
    </button>
  );
}

export default function Header({ onOpenSync, onOpenPeople }: { onOpenSync: () => void; onOpenPeople: () => void }) {
  const r = useRoom();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const online = r.members.filter((m) => m.online);
  const shown = online.slice(0, 3);
  const names = online.map((m) => (m.isHost ? `${m.name} (host)` : m.name)).join(", ");

  return (
    <header className="relative z-20 pt-safe" data-yt-ceiling>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 sm:px-6">
        <span className="sm:hidden">
          <Wordmark compact />
        </span>
        <span className="hidden sm:inline-flex">
          <Wordmark />
        </span>

        <button
          onClick={async () => (await copyText(r.code)) && toast("Room code copied", "success")}
          className="ml-1 flex h-9 items-center gap-2 rounded-full border border-line bg-white/[0.06] px-3 text-sm font-semibold tracking-[0.08em] backdrop-blur-xl transition hover:bg-white/[0.1] active:scale-95"
          aria-label={`Room code ${r.code}. Copy`}
        >
          {r.code}
          <CopyIcon size={14} className="text-faint" />
        </button>
        <SyncPill onClick={onOpenSync} />

        <div className="ml-auto flex items-center gap-1">
        <Tooltip label={names || "No one online"}>
          <button onClick={onOpenPeople} className="flex items-center pr-1" aria-label={`${online.length} people in the room: ${names}`}>
            <span className="flex -space-x-2">
              {shown.map((m) => (
                <span key={m.id} className="relative rounded-full ring-2 ring-[#0a0a0c]">
                  <Avatar name={m.name} size={32} />
                  {m.isHost && (
                    <CrownIcon size={12} strokeWidth={2.25} className="absolute -top-1.5 left-1/2 -translate-x-1/2 fill-warn text-warn" aria-hidden="true" />
                  )}
                </span>
              ))}
              {online.length > shown.length && (
                <span className="grid size-8 place-items-center rounded-full bg-white/[0.12] text-sm font-semibold ring-2 ring-[#0a0a0c] backdrop-blur">
                  +{online.length - shown.length}
                </span>
              )}
            </span>
          </button>
        </Tooltip>

        <Tooltip label="Leave room">
          <button className="icon-btn text-muted hover:text-ink" onClick={() => setConfirmLeave(true)} aria-label="Leave room">
            <LeaveIcon size={20} />
          </button>
        </Tooltip>
        </div>
      </div>

      <Sheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this room?">
        <p className="text-base text-muted">Music stops on this device. You can rejoin with code {r.code} while the room is open.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn btn-secondary" onClick={() => setConfirmLeave(false)}>
            Stay
          </button>
          <button className="btn bg-danger/90 text-white hover:bg-danger" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </Sheet>
    </header>
  );
}
