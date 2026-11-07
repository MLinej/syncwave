import type { Track } from "@/types";
import { libraryColor } from "@/utils/artworkColor";
import { MusicIcon } from "./Icons";

interface Props {
  track: Track | null | undefined;
  className?: string;
  rounded?: string;
  iconSize?: number;
}

/** Cover art: the thumbnail, or a colored "playlist cover" tile for library songs. */
export default function Artwork({ track, className = "size-12", rounded = "rounded-[12px]", iconSize = 18 }: Props) {
  if (track?.thumbnail) {
    return (
      <div className={`relative shrink-0 overflow-hidden bg-white/[0.06] ${rounded} ${className}`}>
        <img src={track.thumbnail} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      </div>
    );
  }
  const color = track ? libraryColor(track.title) : "hsl(240 6% 25%)";
  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden text-white/85 ${rounded} ${className}`}
      style={{ background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 35%, #0a0a0c))` }}
    >
      <MusicIcon size={iconSize} />
    </div>
  );
}
