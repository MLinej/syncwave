import { motion } from "framer-motion";
import { useRoom } from "@/hooks/useRoom";
import { useApp } from "@/context/AppContext";
import Loader from "@/components/Loader/Loader";

export default function CreateRoom() {
  const { create } = useRoom();
  const { loading } = useApp();

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full pb-32">
      <div className="backdrop-blur-[20px] bg-[rgba(255,255,255,0.06)] rounded-[40px] border border-[rgba(255,255,255,0.08)] p-12 flex flex-col items-center text-center max-w-md w-full shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
        <div className="w-20 h-20 bg-[rgba(198,191,255,0.1)] rounded-full flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8Zm4 9h-3v3H9v-3H6V9h3V6h2v3h3v2Z" fill="#C6BFFF" />
          </svg>
        </div>
        <h2 className="text-white text-[32px] font-black tracking-[-0.64px] font-[Inter,sans-serif] leading-[1.2] mb-4">
          Start a new session
        </h2>
        <p className="text-[rgba(255,255,255,0.6)] text-[16px] font-[Inter,sans-serif] mb-10">
          Create a synchronized room to listen to music with your friends in real-time.
        </p>
        
        {loading ? (
          <Loader variant="spinner" message="Creating room..." />
        ) : (
          <motion.button
            onClick={create}
            className="w-full bg-[#c6bfff] text-[#121414] font-bold text-[16px] font-[Inter,sans-serif] py-4 rounded-xl shadow-[0px_10px_20px_-5px_rgba(198,191,255,0.3)]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Generate Room Code
          </motion.button>
        )}
      </div>
    </div>
  );
}
