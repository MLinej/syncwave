import { motion } from "framer-motion";
import { useRoom } from "@/hooks/useRoom";

function ShareIcon() {
  return (
    <svg width="10.5" height="11.667" viewBox="0 0 10.5 11.6667" fill="none">
      <path d="M8.5 8.167a1.5 1.5 0 0 0-1.02.4L3.875 6.5c.042-.163.042-.337 0-.5L7.48 3.967a1.5 1.5 0 1 0-.48-1.084c0 .084.008.167.025.25L3.42 5.167a1.5 1.5 0 1 0 0 2.166L7.025 9.4a1.5 1.5 0 1 0 1.475-1.233Z"
        fill="white" />
    </svg>
  );
}

function QRPattern() {
  return (
    <svg width="27" height="27" viewBox="0 0 27 27" fill="none">
      <rect x="0" y="0" width="12" height="12" rx="2" fill="white" />
      <rect x="15" y="0" width="12" height="12" rx="2" fill="white" />
      <rect x="0" y="15" width="12" height="12" rx="2" fill="white" />
      <rect x="15" y="15" width="5" height="5" rx="1" fill="white" />
      <rect x="22" y="15" width="5" height="5" rx="1" fill="white" />
      <rect x="15" y="22" width="5" height="5" rx="1" fill="white" />
      <rect x="3" y="3" width="6" height="6" fill="#1e1244" />
      <rect x="18" y="3" width="6" height="6" fill="#1e1244" />
      <rect x="3" y="18" width="6" height="6" fill="#1e1244" />
    </svg>
  );
}

export default function QRCard() {
  const { room, copyRoomId, shareInvitation } = useRoom();

  return (
    <div className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.04)] rounded-2xl border border-[rgba(255,255,255,0.08)] p-4 flex flex-col items-center gap-3 w-full">
      {/* QR area */}
      <div className="bg-white rounded-xl p-2 w-32 h-32 flex items-center justify-center overflow-hidden">
        {room?.code ? (
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${room.code}`} alt="QR Code" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div
            className="w-full h-full rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgb(49,46,129) 0%, rgb(0,0,0) 100%)" }}
          >
            <QRPattern />
          </div>
        )}
      </div>

      {/* Room ID */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[rgba(255,255,255,0.6)] text-[10px] font-bold tracking-[1px] uppercase font-[Inter,sans-serif]">
          ROOM ID
        </span>
        <motion.button
          className="text-white text-[18px] font-mono tracking-[-0.9px] font-bold"
          onClick={copyRoomId}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Click to copy"
        >
          {room?.code ?? "------"}
        </motion.button>
      </div>

      {/* Share button */}
      <motion.button
        onClick={shareInvitation}
        className="w-full bg-[rgba(255,255,255,0.05)] rounded-xl py-2 flex items-center justify-center gap-2 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      >
        <ShareIcon />
        <span className="text-white text-[12px] font-bold font-[Inter,sans-serif]">Share Invitation</span>
      </motion.button>
    </div>
  );
}
