import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { usePlayback } from "@/hooks/usePlayback";
import { formatDuration } from "@/utils/format";
import imgAlbum from "@/imports/Html→Body/37e34ab080a1bf031bdaf25afbf40fec4726eb42.png";

function PrevIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M0 0H2V16H0V0ZM16 0V16L4 8L16 0Z" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M16 0H14V16H16V0ZM0 0V16L12 8L0 0Z" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
      <path d="M13 0L5 6L13 12V0ZM0 0H2V12H0V0Z" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
      <path d="M0 0L8 6L0 12V0ZM13 0H11V12H13V0Z" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="15" height="17.5" viewBox="0 0 15 17.5" fill="none">
      <path d="M0 17.5V0L15 8.75L0 17.5Z" fill="#121414" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
      <rect x="0" y="0" width="4" height="14" rx="1" fill="#121414" />
      <rect x="8" y="0" width="4" height="14" rx="1" fill="#121414" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="7.875" height="9.333" viewBox="0 0 7.875 9.33333" fill="none">
      <path d="M0 3.333v2.667h1.75L3.938 8V1.333L1.75 3.333H0Zm5.25-1.666v6c.875-.333 1.5-1.167 1.5-2 0-.834-.625-1.834-1.5-2ZM5.25 0C6.65.5 7.875 1.667 7.875 3.5s-1.225 3-2.625 3.5v-7Z"
        fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function VolumeHighIcon() {
  return (
    <svg width="10.5" height="10.208" viewBox="0 0 10.5 10.2083" fill="none">
      <path d="M0 3.854v2.5H1.75L4.375 8.854V1.354L1.75 3.854H0ZM6.563 4.604c0-.875-.5-1.604-1.25-2v4c.75-.417 1.25-1.146 1.25-2.021ZM5.313 0v1.021c1.5.458 2.625 1.875 2.625 3.583 0 1.709-1.125 3.125-2.625 3.584V9.25C7.25 8.75 8.75 6.833 8.75 4.604c0-2.229-1.5-4.146-3.438-4.604ZM5.313 3.042v3.125c.5-.25.875-.771.875-1.563 0-.791-.375-1.312-.875-1.562Z"
        fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="12.833" height="12.25" viewBox="0 0 12.8333 12.25" fill="none">
      <path d="M10.25 1.917 8.917 3.25a4.583 4.583 0 1 1-7.334 5.333H3.25L0 5.333l-.083 3.25h1.25A6.083 6.083 0 0 0 12.25 6.125a6.083 6.083 0 0 0-2-4.208Z"
        fill="#FFB3AE" />
    </svg>
  );
}

function HeartIcon30() {
  return (
    <svg width="28" height="18.35" viewBox="0 0 28 18.35" fill="none">
      <path d="M14 18.35L12.18 16.7C4.76 9.96 0 5.97 0 5.5 0 2.4 2.4 0 5.5 0c1.74 0 3.41.81 4.5 2.09 1.09-1.28 2.76-2.09 4.5-2.09 3.1 0 5.5 2.42 5.5 5.5 0 .47-4.76 4.46-12.18 11.2z" fill="rgba(255,255,255,0.3)"
        transform="translate(0,0)" />
      <path d="M14 18.35l1.82-1.65C23.24 9.96 28 5.97 28 5.5 28 2.4 25.6 0 22.5 0c-1.74 0-3.41.81-4.5 2.09C16.91.81 15.24 0 13.5 0" fill="none" />
    </svg>
  );
}

export default function BottomPlayer() {
  const { currentTrack, playbackState, latency, isHost, connectedUsers } = useApp();
  const { play, pause, seek, setVolume } = usePlayback();
  const { isPlaying, position, volume } = playbackState;

  const isEveryoneReady = connectedUsers.every(u => u.trackStatus === 'ready');
  const duration = currentTrack?.duration ?? 0;
  const progress = duration > 0 ? position / duration : 0;

  const handlePlayPause = () => {
    if (currentTrack && isHost) {
      if (isPlaying) pause();
      else if (isEveryoneReady) play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHost) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seek(pct * duration);
  };

  const handleVolume = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    setVolume(pct);
  };

  return (
    <motion.div
      className="fixed bottom-8 left-16 right-16 max-w-[1152px] mx-auto backdrop-blur-[20px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-full px-8 py-4 flex items-center justify-between shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] z-50"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      {/* Track info */}
      <div className="flex items-center gap-4 w-[271px]">
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.1)] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1)]">
            {currentTrack?.coverUrl ? (
              <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
            ) : (
              <img src={imgAlbum} alt="Now playing" className="w-full h-full object-cover" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[14px] font-bold truncate font-[Inter,sans-serif]">
            {currentTrack?.title ?? "No track playing"}
          </p>
          <p className="text-[rgba(255,255,255,0.4)] text-[12px] truncate font-[Inter,sans-serif]">
            {currentTrack?.artist ?? ""}
          </p>
        </div>
        <button className="opacity-30 hover:opacity-60 transition-opacity">
          <HeartIcon30 />
        </button>
      </div>

      {/* Controls + seek */}
      <div className="flex flex-col items-center gap-2 max-w-[512px] w-[512px]">
        <div className="flex items-center gap-8">
          <motion.button className="opacity-40 hover:opacity-80 transition-opacity" whileTap={{ scale: 0.9 }}>
            <PrevIcon />
          </motion.button>
          <motion.button className="opacity-70 hover:opacity-100 transition-opacity" whileTap={{ scale: 0.9 }}>
            <SkipBackIcon />
          </motion.button>
          <motion.button
            onClick={handlePlayPause}
            disabled={!isHost || !currentTrack || (!isPlaying && !isEveryoneReady)}
            className={`w-12 h-12 rounded-full flex items-center justify-center drop-shadow-[0px_0px_10px_rgba(255,255,255,0.3)] ${(!isHost || !currentTrack || (!isPlaying && !isEveryoneReady)) ? 'bg-[rgba(255,255,255,0.3)] cursor-not-allowed' : 'bg-white'}`}
            whileHover={(!isHost || !currentTrack || (!isPlaying && !isEveryoneReady)) ? {} : { scale: 1.06 }} 
            whileTap={(!isHost || !currentTrack || (!isPlaying && !isEveryoneReady)) ? {} : { scale: 0.94 }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </motion.button>
          <motion.button className="opacity-70 hover:opacity-100 transition-opacity" whileTap={{ scale: 0.9 }}>
            <SkipForwardIcon />
          </motion.button>
          <motion.button className="opacity-40 hover:opacity-80 transition-opacity" whileTap={{ scale: 0.9 }}>
            <NextIcon />
          </motion.button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-4 w-full">
          <span className="text-[rgba(255,255,255,0.4)] text-[10px] font-mono shrink-0">
            {formatDuration(position)}
          </span>
          <div
            className={`flex-1 h-1 bg-[rgba(255,255,255,0.1)] rounded-full relative overflow-hidden ${isHost ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            onClick={handleSeek}
          >
            <motion.div
              className="absolute inset-y-0 left-0 bg-[#c6bfff] rounded-full"
              style={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span className="text-[rgba(255,255,255,0.4)] text-[10px] font-mono shrink-0">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* Volume + sync status */}
      <div className="flex items-center justify-end gap-6 w-[271px]">
        <div className="flex items-center gap-2">
          <VolumeIcon />
          <div
            className="w-20 h-1 bg-[rgba(255,255,255,0.1)] rounded-full relative cursor-pointer"
            onClick={handleVolume}
          >
            <div
              className="absolute inset-y-0 left-0 bg-[rgba(255,255,255,0.4)] rounded-full"
              style={{ width: `${volume * 100}%` }}
            />
          </div>
          <VolumeHighIcon />
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <SyncIcon />
            <span className="text-[#ffb3ae] text-[10px] font-black tracking-[-0.5px] uppercase font-[Inter,sans-serif]">
              SYNCED
            </span>
          </div>
          <span className="text-[rgba(255,255,255,0.2)] text-[9px] font-mono">
            LATENCY: {latency > 0 ? `${latency}MS` : "--"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
