import { useEffect, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import { useIsHost, useMe, useRoom } from "@/state/selectors";
import * as room from "@/services/room";
import type { QueueItem } from "@/types";
import TrackRow from "./TrackRow";
import { EqBars } from "./NowPlaying";
import { displayTrack } from "@/utils/format";
import { CheckIcon, ChevronUpIcon, CloseIcon, GripIcon, PlayIcon, PlusIcon, QueueIcon, TrashIcon } from "@/components/ui/Icons";

const EASE = [0.22, 1, 0.36, 1] as const;
const enter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.24, ease: EASE },
};

/** Section label that sticks to the top of the scrolling panel. */
function StickyLabel({ children, count }: { children: string; count?: number }) {
  return (
    <h3 className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-[#121216]/85 px-4 py-2 text-sm font-semibold text-muted backdrop-blur-xl">
      {children}
      {!!count && <span className="text-faint tabular-nums">{count}</span>}
    </h3>
  );
}

function EmptyState({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-white/[0.06] text-muted">
        <QueueIcon size={20} />
      </span>
      <p className="mt-4 text-base text-muted">{text}</p>
      {action && onAction && (
        <button className="btn btn-primary mt-4" onClick={onAction}>
          <PlusIcon size={18} strokeWidth={2.25} /> {action}
        </button>
      )}
    </div>
  );
}

function UpNextRow({ item, index, isHost, onDragEnd }: { item: QueueItem; index: number; isHost: boolean; onDragEnd: () => void }) {
  const controls = useDragControls();
  const me = useMe();
  const row = (
    <TrackRow
      track={item.track}
      meta={
        <>
          {displayTrack(item.track).artist}
          {item.addedBy && ` · ${item.addedBy.id === me ? "you" : item.addedBy.name}`}
        </>
      }
      leading={
        isHost ? (
          <button
            className="-ml-1 grid h-10 w-6 shrink-0 cursor-grab touch-none place-items-center text-faint hover:text-ink active:cursor-grabbing"
            onPointerDown={(e) => controls.start(e)}
            aria-label={`Drag to reorder ${displayTrack(item.track).title}`}
          >
            <GripIcon size={16} />
          </button>
        ) : (
          <span className="w-6 shrink-0 text-center text-sm text-faint tabular-nums">{index + 1}</span>
        )
      }
      actions={
        isHost && (
          <>
            <button className="icon-btn size-10 text-muted hover:text-ink" onClick={() => room.playFromQueue(item.uid)} aria-label="Play now">
              <PlayIcon size={15} />
            </button>
            <button className="icon-btn size-10 text-faint hover:text-ink" onClick={() => room.removeFromQueue(item.uid)} aria-label="Remove from queue">
              <TrashIcon size={17} />
            </button>
          </>
        )
      }
    />
  );

  if (!isHost) return <motion.li {...enter}>{row}</motion.li>;
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className="relative list-none rounded-[16px] bg-transparent"
      whileDrag={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)", boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}
      {...enter}
    >
      {row}
    </Reorder.Item>
  );
}

export default function QueuePanel({ onGoToAdd }: { onGoToAdd: () => void }) {
  const r = useRoom();
  const isHost = useIsHost();
  const me = useMe();
  const playing = r.playback.status === "playing";

  // Local order while dragging; server order otherwise.
  const [order, setOrder] = useState(r.queue);
  const orderRef = useRef(order);
  orderRef.current = order;
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setOrder(r.queue);
  }, [r.queue]);

  const commitMove = (uid: string) => {
    dragging.current = false;
    const to = orderRef.current.findIndex((q) => q.uid === uid);
    const from = r.queue.findIndex((q) => q.uid === uid);
    if (to !== -1 && from !== -1 && to !== from) room.moveInQueueTo(uid, to);
  };

  if (!r.current && r.queue.length === 0 && r.suggestions.length === 0) {
    return <EmptyState text={isHost ? "Your queue is empty." : "Nothing in the queue yet."} action={isHost ? "Add a song" : "Suggest a song"} onAction={onGoToAdd} />;
  }

  return (
    <div className="px-4 pb-6">
      {r.current && (
        <section>
          <StickyLabel>Now playing</StickyLabel>
          <TrackRow track={r.current.track} highlight badge={<EqBars playing={playing} className="text-accent" />} />
        </section>
      )}

      {/* Requests only appear once someone has suggested something. */}
      <AnimatePresence initial={false}>
        {r.suggestions.length > 0 && (
          <motion.section key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
            <StickyLabel count={r.suggestions.length}>{isHost ? "Requests" : "Suggestions"}</StickyLabel>
            <ul>
              <AnimatePresence initial={false}>
                {r.suggestions.map((s) => {
                  const voted = !!me && s.votes.includes(me);
                  const mine = !!me && s.by.id === me;
                  return (
                    <motion.li key={s.uid} {...enter}>
                      <TrackRow
                        track={s.track}
                        meta={
                          <>
                            <span className="text-ink/90">{mine ? "You" : s.by.name}</span> · {displayTrack(s.track).artist}
                          </>
                        }
                        actions={
                          <>
                            <button
                              onClick={() => room.vote(s.uid)}
                              className={`flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-2 text-sm font-semibold tabular-nums transition active:scale-90 ${
                                voted ? "bg-accent/15 text-accent" : "text-muted hover:bg-white/[0.08] hover:text-ink"
                              }`}
                              aria-label={voted ? "Remove your vote" : "Vote for this song"}
                              aria-pressed={voted}
                            >
                              <ChevronUpIcon size={16} strokeWidth={2.25} />
                              {s.votes.length}
                            </button>
                            {isHost ? (
                              <>
                                <button
                                  className="grid size-10 place-items-center rounded-full bg-ok/15 text-ok transition hover:bg-ok/25 active:scale-90"
                                  onClick={() => room.acceptSuggestion(s.uid, "last")}
                                  aria-label="Accept and add to queue"
                                >
                                  <CheckIcon size={18} strokeWidth={2.25} />
                                </button>
                                <button
                                  className="grid size-10 place-items-center rounded-full bg-white/[0.06] text-muted transition hover:bg-danger/15 hover:text-danger active:scale-90"
                                  onClick={() => room.dismissSuggestion(s.uid)}
                                  aria-label="Reject"
                                >
                                  <CloseIcon size={18} strokeWidth={2.25} />
                                </button>
                              </>
                            ) : (
                              mine && (
                                <button className="icon-btn size-10 text-faint hover:text-ink" onClick={() => room.dismissSuggestion(s.uid)} aria-label="Withdraw suggestion">
                                  <CloseIcon size={17} />
                                </button>
                              )
                            )}
                          </>
                        }
                      />
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="mt-4">
        <StickyLabel count={r.queue.length}>Up next</StickyLabel>
        {r.queue.length === 0 ? (
          <div className="flex items-center justify-between gap-4 px-2 py-4">
            <p className="text-sm text-muted">{isHost ? "Nothing queued after this song." : "Nothing queued yet."}</p>
            <button className="btn btn-secondary min-h-10 px-3 text-sm" onClick={onGoToAdd}>
              <PlusIcon size={16} strokeWidth={2.25} /> Add a song
            </button>
          </div>
        ) : isHost ? (
          <Reorder.Group
            axis="y"
            values={order}
            onReorder={(next) => {
              dragging.current = true;
              setOrder(next);
            }}
          >
            <AnimatePresence initial={false}>
              {order.map((item, i) => (
                <UpNextRow key={item.uid} item={item} index={i} isHost onDragEnd={() => commitMove(item.uid)} />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {r.queue.map((item, i) => (
                <UpNextRow key={item.uid} item={item} index={i} isHost={false} onDragEnd={() => {}} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
