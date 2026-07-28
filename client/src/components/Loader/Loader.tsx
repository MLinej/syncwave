import { motion } from "framer-motion";

interface LoaderProps {
  variant?: "spinner" | "skeleton" | "error" | "empty";
  message?: string;
}

export function Spinner() {
  return (
    <motion.div
      className="w-8 h-8 rounded-full border-2 border-[rgba(255,255,255,0.1)] border-t-[rgba(198,191,255,0.8)]"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    />
  );
}

export function SongRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] animate-pulse">
      <div className="w-8 h-4 bg-[rgba(255,255,255,0.08)] rounded" />
      <div className="w-10 h-10 bg-[rgba(255,255,255,0.08)] rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[rgba(255,255,255,0.08)] rounded w-40" />
        <div className="h-3 bg-[rgba(255,255,255,0.06)] rounded w-24" />
      </div>
      <div className="w-10 h-3 bg-[rgba(255,255,255,0.06)] rounded" />
    </div>
  );
}

export function MemberSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.08)]" />
      <div className="space-y-1 flex-1">
        <div className="h-3 bg-[rgba(255,255,255,0.08)] rounded w-20" />
        <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded w-14" />
      </div>
    </div>
  );
}

export default function Loader({ variant = "spinner", message }: LoaderProps) {
  if (variant === "spinner") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <Spinner />
        {message && <p className="text-[rgba(255,255,255,0.4)] text-sm font-[Inter,sans-serif]">{message}</p>}
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <div className="w-10 h-10 rounded-full bg-[rgba(255,77,77,0.1)] flex items-center justify-center">
          <span className="text-[#ff4d4d] text-lg">!</span>
        </div>
        <p className="text-[rgba(255,255,255,0.6)] text-sm font-[Inter,sans-serif]">{message || "Something went wrong"}</p>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.04)] flex items-center justify-center mb-1">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M9 3H15L15 15H9V3Z" fill="rgba(255,255,255,0.15)" />
            <path d="M5 7H9V15H5V7Z" fill="rgba(255,255,255,0.1)" />
          </svg>
        </div>
        <p className="text-[rgba(255,255,255,0.3)] text-sm font-[Inter,sans-serif]">{message || "Nothing here yet"}</p>
      </div>
    );
  }

  return null;
}
