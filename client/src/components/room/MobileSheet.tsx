import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useIsHost, useRoom } from "@/state/selectors";
import * as room from "@/services/room";
import { usePlaybackPosition } from "@/sync/hooks";
import { displayTrack } from "@/utils/format";
import Artwork from "@/components/ui/Artwork";
import { PauseIcon, PlayIcon } from "@/components/ui/Icons";

const EASE = [0.22, 1, 0.36, 1] as const;

function MiniPlayer() {
  const r = useRoom();
  const isHost = useIsHost();
  const position = usePlaybackPosition(500);
  if (!r.current) return null;
  const { track } = r.current;
  const d = displayTrack(track);
  const playing = r.playback.status === "playing";
  const pct = track.duration ? Math.min(100, (position / track.duration) * 100) : 0;

  return (
    <div className="relative mx-4 mb-2 overflow-hidden rounded-[16px] border border-line bg-white/[0.06]">
      <div className="flex items-center gap-3 p-2">
        {track.source === "youtube" ? (
          <div className="h-10 w-[72px] shrink-0 rounded-[10px] bg-black/40" data-yt-slot="mini" data-yt-radius="10px" data-yt-z="45" />
        ) : (
          <Artwork track={track} className="size-10" rounded="rounded-[10px]" iconSize={14} />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{d.title}</div>
          <div className="truncate text-sm text-muted">{d.artist}</div>
        </div>
        {isHost && (
          <button
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#0a0a0c] transition active:scale-90"
            onClick={playing ? room.pause : room.play}
            aria-label={playing ? "Pause for everyone" : "Play for everyone"}
          >
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} className="translate-x-px" />}
          </button>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Tab switcher; tapping it while collapsed should also open the sheet. */
  tabs: ReactNode;
  children: ReactNode;
}

/**
 * Draggable bottom sheet for Queue / Search / People on phones. Collapsed it
 * peeks the tab switcher; open it covers most of the screen and shows a mini
 * player on top (which also takes over the YouTube video).
 */
export default function MobileSheet({ open, setOpen, tabs, children }: Props) {
  const controls = useDragControls();
  const headRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(() => window.innerHeight);
  const [peek, setPeek] = useState(96);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Collapsed height = handle + tabs (measured) + the device's bottom safe area.
  useLayoutEffect(() => {
    const measure = () => setPeek((headRef.current?.offsetHeight ?? 80) + (safeRef.current?.offsetHeight ?? 0) + 8);
    measure();
    const ro = new ResizeObserver(measure);
    if (headRef.current) ro.observe(headRef.current);
    return () => ro.disconnect();
  }, [open]);

  const height = Math.round(vh * 0.9);
  const closedY = height - peek;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-30 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
      <motion.section
        className="glass fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[28px] bg-[#121216]/85"
        style={{ height }}
        initial={false}
        animate={{ y: open ? 0 : closedY }}
        transition={{ duration: 0.4, ease: EASE }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: closedY }}
        dragElastic={0.04}
        onDragEnd={(_, info) => {
          if (info.velocity.y < -300 || info.offset.y < -60) setOpen(true);
          else if (info.velocity.y > 300 || info.offset.y > 60) setOpen(false);
        }}
        aria-label="Queue, search and people"
      >
        <div ref={headRef} className="shrink-0 touch-none" onPointerDown={(e) => controls.start(e)}>
          <button className="flex h-6 w-full items-center justify-center" onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"}>
            <span className="h-1 w-10 rounded-full bg-white/25" />
          </button>
          {open && <MiniPlayer />}
          <div className="px-4 pb-2">{tabs}</div>
        </div>
        <div className={`min-h-0 flex-1 overscroll-contain ${open ? "overflow-y-auto" : "overflow-hidden"}`}>{children}</div>
        <div ref={safeRef} className="pb-safe" aria-hidden="true" />
      </motion.section>
    </>
  );
}
