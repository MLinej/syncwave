import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@/types";
import { MemberSkeleton } from "@/components/Loader/Loader";

function KebabIcon() {
  return (
    <svg width="10.5" height="10.2" viewBox="0 0 10.5 10.2083" fill="none">
      <circle cx="1.75" cy="5.1" r="1.75" fill="rgba(255,255,255,0.2)" />
      <circle cx="5.25" cy="5.1" r="1.75" fill="rgba(255,255,255,0.2)" />
      <circle cx="8.75" cy="5.1" r="1.75" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

interface MemberItemProps {
  user: User;
}

function MemberItem({ user }: MemberItemProps) {
  return (
    <motion.div
      className="flex items-center justify-between w-full"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[rgba(198,191,255,0.2)] flex items-center justify-center">
              <span className="text-[#c6bfff] text-xs font-bold font-[Inter,sans-serif]">
                {user.name[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          )}
          {user.isOnline && (
            <div className="absolute bottom-[-2px] right-[-2px] w-2.5 h-2.5 rounded-full bg-[#22c55e] border-2 border-[#121414]" />
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-white text-[12px] font-bold font-[Inter,sans-serif] leading-[16px]">
              {user.name}
            </span>
            {user.isHost && (
              <span className="bg-[rgba(198,191,255,0.2)] text-[#c6bfff] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                Host
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[rgba(255,255,255,0.4)] text-[10px] font-[Inter,sans-serif] leading-[15px]">
              {user.latency != null ? `${user.latency}ms` : "--ms"}
            </span>
            <span className="text-[rgba(255,255,255,0.2)] text-[10px]">•</span>
            <span className={`text-[10px] font-bold font-[Inter,sans-serif] uppercase ${
              user.trackStatus === 'error' ? 'text-red-400' :
              user.trackStatus === 'ready' ? 'text-green-400' :
              user.trackStatus === 'loading' ? 'text-yellow-400' :
              'text-[rgba(255,255,255,0.4)]'
            }`}>
              {user.trackStatus || 'IDLE'}
            </span>
          </div>
        </div>
      </div>
      <button className="opacity-60 hover:opacity-100 transition-opacity">
        <KebabIcon />
      </button>
    </motion.div>
  );
}

interface MemberListProps {
  users: User[];
  isLoading?: boolean;
}

export default function MemberList({ users, isLoading }: MemberListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => <MemberSkeleton key={i} />)}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="text-[rgba(255,255,255,0.3)] text-[12px] font-[Inter,sans-serif] text-center py-4">
        No members connected
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <AnimatePresence mode="popLayout">
        {users.map((user) => (
          <MemberItem key={user.id} user={user} />
        ))}
      </AnimatePresence>
    </div>
  );
}
