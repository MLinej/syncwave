import { motion } from "framer-motion";
import { useRoom } from "@/hooks/useRoom";
import { useApp } from "@/context/AppContext";
import Loader from "@/components/Loader/Loader";

export default function JoinRoom() {
  const { join, joinRoomId, setJoinRoomId } = useRoom();
  const { loading } = useApp();

  const handleJoin = () => {
    if (joinRoomId.length === 6) {
      join(joinRoomId);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full pb-32">
      <div className="backdrop-blur-[20px] bg-[rgba(255,255,255,0.06)] rounded-[40px] border border-[rgba(255,255,255,0.08)] p-12 flex flex-col items-center text-center max-w-md w-full shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
        <div className="w-20 h-20 bg-[rgba(198,191,255,0.1)] rounded-full flex items-center justify-center mb-6">
          <svg width="32" height="24" viewBox="0 0 24 16" fill="none">
            <path d="M0 0H24V2H0V0ZM0 7H18V9H0V7ZM0 14H24V16H0V14Z" fill="#C6BFFF" />
          </svg>
        </div>
        <h2 className="text-white text-[32px] font-black tracking-[-0.64px] font-[Inter,sans-serif] leading-[1.2] mb-4">
          Join a session
        </h2>
        <p className="text-[rgba(255,255,255,0.6)] text-[16px] font-[Inter,sans-serif] mb-8">
          Enter the 6-character room code provided by the host.
        </p>
        
        <input
          type="text"
          value={joinRoomId}
          onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
          placeholder="e.g. A7K2PQ"
          maxLength={6}
          className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-xl py-4 px-6 text-white text-[24px] font-mono font-bold tracking-[4px] text-center mb-8 outline-none focus:border-[rgba(255,255,255,0.3)] transition-colors"
        />

        {loading ? (
          <Loader variant="spinner" message="Joining room..." />
        ) : (
          <motion.button
            onClick={handleJoin}
            disabled={joinRoomId.length !== 6}
            className={`w-full font-bold text-[16px] font-[Inter,sans-serif] py-4 rounded-xl transition-all ${
              joinRoomId.length === 6 
                ? "bg-[#c6bfff] text-[#121414] shadow-[0px_10px_20px_-5px_rgba(198,191,255,0.3)] cursor-pointer" 
                : "bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.3)] cursor-not-allowed"
            }`}
            whileHover={joinRoomId.length === 6 ? { scale: 1.02 } : {}}
            whileTap={joinRoomId.length === 6 ? { scale: 0.98 } : {}}
          >
            Join Room
          </motion.button>
        )}
      </div>
    </div>
  );
}
