import type { ReactNode } from "react";
import type { Track } from "@/types";
import Artwork from "@/components/ui/Artwork";
import { displayTrack, formatDuration } from "@/utils/format";

interface Props {
  track: Track;
  meta?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  footer?: ReactNode;
  highlight?: boolean;
  /** Overlay on the artwork (e.g. equalizer for the playing song). */
  badge?: ReactNode;
}

/** A song row: thumbnail, cleaned title, artist · duration, actions. */
export default function TrackRow({ track, meta, actions, leading, footer, highlight, badge }: Props) {
  const d = displayTrack(track);
  return (
    <div className={`row ${footer ? "items-start" : ""}`}>
      {leading}
      <div className="relative shrink-0">
        <Artwork track={track} className="size-12" iconSize={16} />
        {badge && <div className="absolute inset-0 grid place-items-center rounded-[12px] bg-black/45">{badge}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-base font-semibold ${highlight ? "text-accent" : "text-ink"}`} title={track.title}>
          {d.title}
        </div>
        <div className="truncate text-sm text-muted">
          {meta ?? (
            <>
              {d.artist}
              {track.duration ? <span className="tabular-nums"> · {formatDuration(track.duration)}</span> : null}
            </>
          )}
        </div>
        {footer && <div className="mt-2 flex flex-wrap gap-2">{footer}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
