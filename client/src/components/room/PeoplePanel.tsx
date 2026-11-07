import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useIsHost, useMe, useRoom } from "@/state/selectors";
import * as room from "@/services/room";
import type { Member } from "@/types";
import Avatar from "@/components/ui/Avatar";
import InviteCard from "./InviteCard";
import { CrownIcon } from "@/components/ui/Icons";

function statusOf(m: Member): { dot: "ready" | "offline" | "busy"; text: string } {
  if (!m.online) return { dot: "offline", text: "Offline" };
  if (m.trackStatus === "ready") return { dot: "ready", text: "Ready" };
  if (m.trackStatus === "loading") return { dot: "busy", text: "Loading song" };
  if (m.trackStatus === "error") return { dot: "busy", text: "Can't play this song" };
  return { dot: "ready", text: "Online" };
}

export default function PeoplePanel() {
  const r = useRoom();
  const isHost = useIsHost();
  const meId = useMe();
  // Touch devices have no hover: tapping a row reveals its "Make host" button.
  const [revealed, setRevealed] = useState<string | null>(null);

  return (
    <div className="space-y-6 px-4 pt-2 pb-6">
      <InviteCard code={r.code} />

      <section>
        <h3 className="px-2 pb-2 text-sm font-semibold text-muted">
          In the room <span className="text-faint tabular-nums">{r.members.filter((m) => m.online).length}</span>
        </h3>
        <ul>
          <AnimatePresence initial={false}>
            {r.members.map((m) => {
              const me = m.id === meId;
              const st = statusOf(m);
              const canPromote = isHost && !me && m.online;
              return (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="group row"
                  onClick={() => canPromote && setRevealed((id) => (id === m.id ? null : m.id))}
                >
                  <Avatar name={m.name} size={44} dim={!m.online} ring={m.isHost} status={st.dot} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate text-base font-semibold">
                      {m.name}
                      {me && <span className="font-normal text-faint">(you)</span>}
                      {m.isHost && <CrownIcon size={14} className="shrink-0 fill-warn text-warn" aria-label="Host" />}
                    </div>
                    <div className="text-sm text-muted">{m.isHost ? `Host · ${st.text}` : st.text}</div>
                  </div>
                  {canPromote && (
                    <button
                      className={`btn btn-ghost min-h-10 px-3 text-sm transition-opacity focus-visible:opacity-100 ${
                        revealed === m.id ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Make ${m.name} the host? You will lose playback control.`)) room.transferHost(m.id);
                      }}
                    >
                      Make host
                    </button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </section>
    </div>
  );
}
