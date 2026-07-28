import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { usePlayback } from "@/hooks/usePlayback";
import Loader from "@/components/Loader/Loader";
import imgNowPlaying from "@/imports/Html→Body/6309e358d4e9fe1f81bb5680d9edd5a56e574f2e.png";

function PlayIcon() {
  return (
    <svg width="11" height="14" viewBox="0 0 11 14" fill="none">
      <path d="M0 14V0L11 7L0 14Z" fill="white" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="20" height="18.35" viewBox="0 0 20 18.35" fill="none">
      <path d="M10 18.35L8.55 17.03C3.4 12.36 0 9.28 0 5.5 0 2.42 2.42 0 5.5 0c1.74 0 3.41.81 4.5 2.09C11.09.81 12.76 0 14.5 0 17.58 0 20 2.42 20 5.5c0 3.78-3.4 6.86-8.55 11.54L10 18.35Z"
        fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function RoomIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8Zm4 9h-3v3H9v-3H6V9h3V6h2v3h3v2Z"
        fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function EqualiserBars() {
  return (
    <div className="flex items-end gap-[2px] h-5">
      {[
        { h: 12, delay: 0 },
        { h: 20, delay: 0.1 },
        { h: 8, delay: 0.2 },
      ].map((bar, i) => (
        <motion.div
          key={i}
          className="w-[2px] bg-[#ffb3ae] rounded-full"
          animate={{ height: [bar.h, bar.h * 0.4, bar.h] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: bar.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export default function NowPlayingCard() {
  const { currentTrack, playbackState, loading, isHost, connectedUsers } = useApp();
  const { play, pause } = usePlayback();
  const { isPlaying, position } = playbackState;

  const isEveryoneReady = connectedUsers.every(u => u.trackStatus === 'ready');

  const handlePlaySync = () => {
    if (currentTrack && isHost) {
      if (isPlaying) {
        pause();
      } else if (isEveryoneReady) {
        play();
      }
    }
  };

  return (
    <div className="backdrop-blur-[20px] bg-[rgba(255,255,255,0.06)] h-[320px] rounded-[40px] shrink-0 w-full border border-[rgba(255,255,255,0.08)] overflow-hidden relative">
      <div className="flex items-start p-10 gap-10 h-full">
        {/* Album art */}
        <motion.div
          className="relative rounded-2xl shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] shrink-0 size-[240px] overflow-hidden"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {currentTrack?.coverUrl ? (
            <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
          ) : (
            <img src={imgNowPlaying} alt="Now playing" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.2)]" />
        </motion.div>

        {/* Song info & controls */}
        <div className="flex-1 h-full relative flex flex-col justify-center">
          {loading ? (
            <Loader variant="spinner" message="Loading track..." />
          ) : (
            <>
              {/* Now Playing label */}
              <div className="flex items-center gap-2 mb-2 absolute top-0 left-0">
                <span className="text-[#ffb3ae] text-[11px] font-black tracking-[1.1px] uppercase font-[Inter,sans-serif]">
                  NOW PLAYING
                </span>
                {isPlaying && <EqualiserBars />}
              </div>

              {/* Title */}
              <div className="mt-8">
                <h2 className="text-white text-[48px] font-black tracking-[-0.96px] font-[Inter,sans-serif] leading-[52.8px]">
                  {currentTrack?.title || (
                    <span className="text-[rgba(255,255,255,0.3)]">No track selected</span>
                  )}
                </h2>

                {/* Artist / album */}
                {currentTrack && (
                  <p className="text-[rgba(255,255,255,0.6)] text-[20px] font-semibold font-[Inter,sans-serif] mt-1">
                    {currentTrack.artist} • {currentTrack.album}
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-6 mt-8">
                <motion.button
                  onClick={handlePlaySync}
                  disabled={!isHost || !currentTrack || (!isPlaying && !isEveryoneReady)}
                  className={`drop-shadow-[0px_0px_7.5px_rgba(255,77,77,0.4)] flex items-center gap-2 px-8 py-3 rounded-full ${(!isHost || !currentTrack || (!isPlaying && !isEveryoneReady)) ? 'bg-gray-500 opacity-50 cursor-not-allowed' : 'bg-[#ff4d4d]'}`}
                  whileHover={(!isHost || !currentTrack || (!isPlaying && !isEveryoneReady)) ? {} : { scale: 1.04 }} 
                  whileTap={(!isHost || !currentTrack || (!isPlaying && !isEveryoneReady)) ? {} : { scale: 0.96 }}
                >
                  <PlayIcon />
                  <span className="text-white text-[16px] font-bold font-[Inter,sans-serif] leading-[24px]">
                    {isPlaying ? "Pause" : (!currentTrack ? "Play" : (!isEveryoneReady ? "Waiting..." : "Play"))} Sync
                  </span>
                </motion.button>

                <motion.button
                  className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.2)] px-8 py-3 rounded-full"
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                >
                  <span className="text-white text-[16px] font-bold font-[Inter,sans-serif]">Follow Room</span>
                </motion.button>

                <div className="flex items-center gap-4">
                  <motion.button className="opacity-40 hover:opacity-80 transition-opacity" whileTap={{ scale: 0.9 }}>
                    <HeartIcon />
                  </motion.button>
                  <motion.button className="opacity-40 hover:opacity-80 transition-opacity" whileTap={{ scale: 0.9 }}>
                    <RoomIcon />
                  </motion.button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
