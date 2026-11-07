import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useIsHost, useRoom } from "@/state/selectors";
import { setVolume, syncStore, useStore } from "@/state/store";
import { usePlaybackPosition } from "@/sync/hooks";
import { webAudio } from "@/sync/engines";
import * as room from "@/services/room";
import { displayTrack, formatDuration } from "@/utils/format";
import { hostnameUrlFor, isIpHost } from "@/utils/hostRedirect";
import { libraryColor } from "@/utils/artworkColor";
import Artwork from "@/components/ui/Artwork";
import Avatar from "@/components/ui/Avatar";
import Slider from "@/components/ui/Slider";
import {
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PrevIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  SpinnerIcon,
  VolumeIcon,
} from "@/components/ui/Icons";
import type { Track } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

export function EqBars({ playing, className = "" }: { playing: boolean; className?: string }) {
  return (
    <span className={`inline-flex h-3 items-end gap-[2px] ${className}`} aria-hidden="true">
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className={`w-[3px] rounded-full bg-current ${playing ? "eq-bar h-full" : "h-[3px]"}`} style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

/** Cover with an ambient glow: a blurred copy of itself glowing behind it. */
function Cover({ track, playing, showVideo, uid }: { track: Track; playing: boolean; showVideo: boolean; uid: string }) {
  const isYouTube = track.source === "youtube";
  const glow = track.thumbnail ? (
    <img src={track.thumbnail} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-3xl" aria-hidden="true" />
  ) : (
    <div className="absolute inset-0 scale-110 opacity-40 blur-3xl" style={{ background: libraryColor(track.title) }} aria-hidden="true" />
  );

  return (
    <motion.div
      key={uid}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`relative mx-auto ${isYouTube ? "w-[min(100%,calc(var(--art-size)*1.6))]" : "aspect-square w-[min(100%,var(--art-size))]"}`}
    >
      <div className="pointer-events-none absolute inset-0 translate-y-4">{glow}</div>
      {isYouTube ? (
        // The YouTube iframe is docked over this slot. It must not scale or
        // breathe: the dock follows the slot's box every frame.
        <div
          className="relative aspect-video w-full rounded-[24px] bg-black/40 shadow-[0_24px_60px_rgb(0_0_0/0.5)]"
          {...(showVideo ? { "data-yt-slot": "hero", "data-yt-radius": "24px" } : {})}
        />
      ) : (
        <div className={`group relative size-full ${playing ? "breathe" : ""}`}>
          <Artwork
            track={track}
            className="size-full shadow-[0_24px_60px_rgb(0_0_0/0.5)] transition-transform duration-300 group-hover:scale-[1.02]"
            rounded="rounded-[24px]"
            iconSize={72}
          />
        </div>
      )}
    </motion.div>
  );
}

function VolumePill() {
  const volume = useStore(syncStore, (s) => s.volume);
  const [lastVolume, setLastVolume] = useState(0.9);
  return (
    <div className="group mx-auto flex h-11 w-full max-w-[280px] items-center gap-2 rounded-full border border-line bg-white/[0.05] pr-4 pl-1">
      <button
        className="icon-btn size-9 shrink-0 text-muted hover:text-ink"
        onClick={() => {
          if (volume > 0) {
            setLastVolume(volume);
            setVolume(0);
          } else setVolume(lastVolume || 0.9);
        }}
        aria-label={volume > 0 ? "Mute this device" : "Unmute this device"}
      >
        {volume > 0 ? <VolumeIcon size={18} /> : <MuteIcon size={18} />}
      </button>
      <Slider
        className="flex-1"
        value={volume}
        max={1}
        step={0.05}
        onChange={setVolume}
        onCommit={setVolume}
        ariaLabel="Volume on this device"
        ariaValueText={`${Math.round(volume * 100)}%`}
      />
      <span className="w-9 text-right text-sm text-muted tabular-nums opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
}

function ControlButton({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      className={`icon-btn size-11 ${active ? "text-accent" : "text-ink/80 hover:text-ink"}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

interface Props {
  onOpenSync?: () => void;
  onGoToAdd: () => void;
  /** False while a mobile sheet covers the player, so the video moves to the mini player. */
  showVideo?: boolean;
}

export default function NowPlaying({ onGoToAdd, showVideo = true }: Props) {
  const r = useRoom();
  const isHost = useIsHost();
  const position = usePlaybackPosition();
  const sync = useStore(syncStore, (s) => s);
  const current = r.current;
  const pb = r.playback;
  const playing = pb.status === "playing";

  const online = r.members.filter((m) => m.online);
  const ready = online.filter((m) => m.trackStatus === "ready").length;

  if (!current) {
    return (
      <div className="flex flex-col items-center px-6 py-8 text-center">
        <div className="relative grid aspect-square w-[min(70%,var(--art-size))] place-items-center rounded-[24px] border border-line bg-white/[0.04]">
          <svg viewBox="0 0 24 24" className="size-16 text-faint" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <h2 className="mt-8 text-lg font-semibold">{isHost ? "Start the music" : "Nothing playing yet"}</h2>
        <p className="mt-2 max-w-xs text-base text-muted">
          {isHost ? "Pick a song and it plays on every phone at the same moment." : "Suggest a song and the host can play it for everyone."}
        </p>
        <button className="btn btn-primary mt-6 px-6" onClick={onGoToAdd}>
          <PlusIcon size={18} strokeWidth={2.25} /> {isHost ? "Add a song" : "Suggest a song"}
        </button>
      </div>
    );
  }

  const { track } = current;
  const meta = displayTrack(track);
  const duration = track.duration;
  const RepeatGlyph = r.repeat === "one" ? RepeatOneIcon : RepeatIcon;

  return (
    <div className="flex w-full flex-col">
      <Cover track={track} playing={playing} showVideo={showVideo} uid={current.uid} />

      {track.source === "youtube" &&
        (sync.errorMessage ? (
          <div className="mt-4 rounded-[16px] bg-danger/10 p-4 text-sm font-semibold text-danger">
            {sync.errorMessage}
            {isIpHost() && (
              <a className="btn btn-primary mt-3 w-full" href={`${hostnameUrlFor()}/?room=${r.code}`}>
                Open the YouTube-friendly link
              </a>
            )}
          </div>
        ) : (
          sync.needsVideoTap && <p className="mt-3 text-center text-sm font-semibold text-accent">Tap the video once to join playback</p>
        ))}

      {sync.needsUnlock && (
        <button className="btn btn-accent mt-4 w-full" onClick={() => void webAudio.unlock()}>
          <VolumeIcon size={18} /> Tap to turn on sound
        </button>
      )}

      {/* Title + meta (cross-fades with the track) */}
      <motion.div key={current.uid} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-8 short:mt-4">
        <h2 className="line-clamp-2 text-lg font-semibold tracking-[-0.01em]" title={track.title}>
          {meta.title}
        </h2>
        <p className="mt-1 truncate text-base text-muted">{meta.artist}</p>
        {current.addedBy && (
          <span className="mt-3 inline-flex h-8 items-center short:mt-2 gap-2 rounded-full border border-line bg-white/[0.05] pr-3 pl-1 text-sm text-muted">
            <Avatar name={current.addedBy.name} size={24} />
            Picked by <span className="font-semibold text-ink">{current.addedBy.name}</span>
          </span>
        )}
      </motion.div>

      {/* Progress */}
      <div className="mt-6 short:mt-3">
        <Slider
          value={Math.min(position, duration ?? position)}
          max={duration ?? 0}
          step={5}
          disabled={!isHost || !duration}
          onCommit={room.seek}
          format={formatDuration}
          ariaLabel="Seek"
          ariaValueText={`${formatDuration(position)} of ${formatDuration(duration)}`}
        />
        <div className="mt-1 flex justify-between text-sm text-muted tabular-nums">
          <span>{formatDuration(Math.min(position, duration ?? position))}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Transport */}
      {isHost ? (
        <div className="mt-4 flex items-center justify-between px-2 short:mt-2">
          <ControlButton label="Shuffle queue" onClick={room.shuffleQueue} disabled={r.queue.length < 2}>
            <ShuffleIcon size={20} />
          </ControlButton>
          <ControlButton label={r.hasPrevious ? "Previous song" : "Restart song"} onClick={room.previous}>
            <PrevIcon size={24} />
          </ControlButton>
          <button
            className="grid size-[72px] place-items-center rounded-full bg-white text-[#0a0a0c] shadow-[0_8px_32px_color-mix(in_srgb,var(--accent)_45%,transparent)] transition hover:scale-[1.03] active:scale-95"
            onClick={playing || pb.pendingStart ? room.pause : room.play}
            aria-label={playing ? "Pause for everyone" : "Play for everyone"}
          >
            {pb.pendingStart ? (
              <SpinnerIcon size={28} className="animate-spin" />
            ) : playing ? (
              <PauseIcon size={28} />
            ) : (
              <PlayIcon size={28} className="translate-x-[2px]" />
            )}
          </button>
          <ControlButton label="Next song" onClick={room.next} disabled={r.queue.length === 0 && r.repeat === "off"}>
            <NextIcon size={24} />
          </ControlButton>
          <ControlButton
            label={r.repeat === "off" ? "Repeat: off" : r.repeat === "all" ? "Repeat: all" : "Repeat: one"}
            onClick={room.cycleRepeat}
            active={r.repeat !== "off"}
          >
            <RepeatGlyph size={20} />
          </ControlButton>
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-muted">{playing ? "Playing in sync with the room" : "The host controls playback"}</p>
      )}

      {pb.pendingStart && (
        <p className="mt-2 text-center text-sm font-semibold text-warn">
          Starting when everyone's loaded · {ready}/{online.length} ready
        </p>
      )}

      <div className="mt-6 short:mt-3">
        <VolumePill />
      </div>
    </div>
  );
}
