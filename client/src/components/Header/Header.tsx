import { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";

function ChevronLeftIcon() {
  return (
    <svg width="7.4" height="12" viewBox="0 0 7.4 12" fill="none">
      <path d="M7.4 1.4L6 0L0 6l6 6 1.4-1.4L2.8 6l4.6-4.6Z" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="7.4" height="12" viewBox="0 0 7.4 12" fill="none">
      <path d="M0 10.6L1.4 12L7.4 6L1.4 0 0 1.4 4.6 6 0 10.6Z" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M10.5 9h-.79l-.28-.27A6.47 6.47 0 0 0 11 5.5 6.5 6.5 0 1 0 4.5 12c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4 3.99L14.49 13l-3.99-4Zm-6 0A4.5 4.5 0 1 1 9 4.5 4.5 4.5 0 0 1 4.5 9Z"
        fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function NotificationIcon() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
      <path d="M8 20a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2Zm6-6V9c0-3.07-1.64-5.64-4.5-6.32V2a1.5 1.5 0 0 0-3 0v.68C3.63 3.36 2 5.92 2 9v5l-2 2v1h16v-1l-2-2Z"
        fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
      <path d="M9 10a5 5 0 1 0 0-10A5 5 0 0 0 9 10Zm0 2c-5.34 0-9 2.24-9 5v2h18v-2c0-2.76-3.66-5-9-5Z"
        fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="4" height="16" viewBox="0 0 4 16" fill="none">
      <path d="M2 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="11" height="10.7" viewBox="0 0 11 10.7" fill="none">
      <path d="M5.5 8.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM0 2.7l1.5 1.5a5.75 5.75 0 0 1 8 0L11 2.7A8.26 8.26 0 0 0 0 2.7ZM5.5 5.7a4.25 4.25 0 0 0-3 1.25L4 8.45a2.5 2.5 0 0 1 3 0L8.5 6.95A4.25 4.25 0 0 0 5.5 5.7Z"
        fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

export default function Header() {
  const { roomCode, latency, socketConnected } = useApp();
  const [search, setSearch] = useState("");

  return (
    <div className="h-[114px] relative shrink-0 w-full">
      {/* Left: back/forward + title */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-4">
        <motion.button
          className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] h-10 w-[27px] flex items-center justify-center rounded-full"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => window.history.back()}
        >
          <ChevronLeftIcon />
        </motion.button>
        <motion.button
          className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] h-10 w-[27px] flex items-center justify-center rounded-full"
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => window.history.forward()}
        >
          <ChevronRightIcon />
        </motion.button>

        <div className="flex flex-col gap-1">
          <div className="flex flex-col">
            <h1 className="text-white text-[32px] font-bold tracking-[-0.32px] font-[Inter,sans-serif] leading-[38.4px]">
              Distributed
            </h1>
            <h1 className="text-white text-[32px] font-bold tracking-[-0.32px] font-[Inter,sans-serif] leading-[38.4px]">
              Music Player
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {roomCode && (
              <div className="bg-[rgba(198,191,255,0.2)] px-2 py-[2px] rounded-full">
                <span className="text-[#e4dfff] text-[10px] font-bold font-[Inter,sans-serif] leading-[15px]">
                  ROOM: {roomCode}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <WifiIcon />
              <span className="text-[rgba(255,255,255,0.4)] text-[12px] font-[Inter,sans-serif]">
                Latency: {latency > 0 ? `${latency}ms` : "--"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-[#4ade80]" : "bg-red-500 animate-pulse"}`} />
              <span className={`text-[12px] font-semibold font-[Inter,sans-serif] ${socketConnected ? "text-[#4ade80]" : "text-red-500"}`}>
                {socketConnected ? "Connected" : "Reconnecting..."}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: search + action icons */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-6">
        <div className="backdrop-blur-[20px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] flex items-center gap-3 px-4 py-[9px] rounded-full">
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search track or user..."
            className="bg-transparent text-[14px] text-white placeholder-[rgba(255,255,255,0.2)] font-[Inter,sans-serif] outline-none w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <motion.button className="opacity-60 hover:opacity-100 transition-opacity" whileTap={{ scale: 0.9 }}>
            <NotificationIcon />
          </motion.button>
          <motion.button className="opacity-60 hover:opacity-100 transition-opacity" whileTap={{ scale: 0.9 }}>
            <UserIcon />
          </motion.button>
          <motion.button className="opacity-60 hover:opacity-100 transition-opacity" whileTap={{ scale: 0.9 }}>
            <DotsIcon />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
