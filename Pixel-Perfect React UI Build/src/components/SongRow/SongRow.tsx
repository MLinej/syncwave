import { motion } from "framer-motion";
import type { Song } from "@/types";
import { formatDuration, formatTrackNumber } from "@/utils/format";

function MoreIcon() {
  return (
    <svg width="80" height="60" viewBox="0 0 80 60" fill="none">
      <circle cx="10" cy="30" r="5" fill="rgba(255,255,255,0.2)" />
      <circle cx="40" cy="30" r="5" fill="rgba(255,255,255,0.2)" />
      <circle cx="70" cy="30" r="5" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

function ActiveMoreIcon() {
  return (
    <svg width="80" height="60" viewBox="0 0 80 60" fill="none">
      <circle cx="10" cy="30" r="5" fill="rgba(255,255,255,0.2)" />
      <circle cx="40" cy="30" r="5" fill="rgba(255,255,255,0.2)" />
      <circle cx="70" cy="30" r="5" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

interface SongRowProps {
  song: Song;
  index: number;
  isActive?: boolean;
  onPlay: (song: Song) => void;
}

export default function SongRow({ song, index, isActive, onPlay }: SongRowProps) {
  return (
    <motion.div
      className={`relative rounded-xl w-full border ${
        isActive
          ? "backdrop-blur-[10px] bg-[rgba(255,179,174,0.06)] border-[rgba(255,179,174,0.15)]"
          : "backdrop-blur-[10px] bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)]"
      }`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center overflow-hidden p-px">
        {/* Track number */}
        <div className="w-[51px] flex items-center justify-center py-4 px-4 shrink-0">
          {isActive ? (
            <div className="flex items-end gap-[2px] h-4">
              {[12, 20, 8].map((h, i) => (
                <motion.div
                  key={i}
                  className="w-[2px] bg-[#ffb3ae] rounded-full"
                  style={{ height: h }}
                  animate={{ height: [h, h * 0.3, h] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12, ease: "easeInOut" }}
                />
              ))}
            </div>
          ) : (
            <span className="text-[rgba(255,255,255,0.4)] text-[16px] font-mono">
              {formatTrackNumber(song.trackNumber ?? index + 1)}
            </span>
          )}
        </div>

        {/* Title + art */}
        <div className="w-[169px] flex items-center gap-3 pl-[16px] shrink-0">
          <div
            className="w-[30px] h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer"
            onClick={() => onPlay(song)}
          >
            {song.coverUrl ? (
              <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M0 12V0L12 6L0 12Z" fill="rgba(255,255,255,0.3)" />
                </svg>
              </div>
            )}
          </div>
          <button onClick={() => onPlay(song)} className="text-left">
            <p className={`text-[16px] font-bold font-[Inter,sans-serif] leading-[24px] ${isActive ? "text-[#ffb3ae]" : "text-white"}`}>
              {song.title}
            </p>
          </button>
        </div>

        {/* Artist */}
        <div className="w-[153px] pl-8 pr-4 py-4 shrink-0">
          <p className="text-[rgba(255,255,255,0.6)] text-[16px] font-[Inter,sans-serif]">{song.artist}</p>
        </div>

        {/* Duration */}
        <div className="w-[65px] px-4 py-[30px] shrink-0">
          <span className="text-[rgba(255,255,255,0.4)] text-[14px] font-mono">
            {formatDuration(song.duration)}
          </span>
        </div>

        {/* Album */}
        <div className="flex-1 px-4 py-4">
          <p className="text-[rgba(255,255,255,0.6)] text-[16px] font-[Inter,sans-serif] truncate">{song.album}</p>
        </div>

        {/* More */}
        <div className="w-20 shrink-0">
          {isActive ? <ActiveMoreIcon /> : <MoreIcon />}
        </div>
      </div>
    </motion.div>
  );
}
