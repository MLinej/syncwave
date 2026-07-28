import { motion } from "framer-motion";

type Variant = "live" | "synced" | "host" | "connected" | "disconnected";

interface StatusBadgeProps {
  variant: Variant;
  label?: string;
}

const config: Record<Variant, { bg: string; text: string; dot?: string; label: string }> = {
  live: { bg: "bg-[rgba(34,197,94,0.2)]", text: "text-[#4ade80]", dot: "bg-[#4ade80]", label: "LIVE" },
  synced: { bg: "bg-[rgba(255,255,255,0.1)]", text: "text-[rgba(255,255,255,0.6)]", label: "SYNCED" },
  host: { bg: "bg-[rgba(198,191,255,0.2)]", text: "text-[#e4dfff]", label: "HOST" },
  connected: { bg: "bg-transparent", text: "text-[#4ade80]", dot: "bg-[#4ade80]", label: "Connected" },
  disconnected: { bg: "bg-transparent", text: "text-[rgba(255,255,255,0.4)]", dot: "bg-[rgba(255,255,255,0.4)]", label: "Disconnected" },
};

export default function StatusBadge({ variant, label }: StatusBadgeProps) {
  const c = config[variant];
  const displayLabel = label ?? c.label;

  return (
    <motion.div
      className={`inline-flex items-center gap-[4px] px-[12px] py-[4px] rounded-full ${c.bg}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {c.dot && <div className={`w-[6px] h-[6px] rounded-full shrink-0 ${c.dot}`} />}
      <span className={`text-[10px] font-bold tracking-[0.5px] uppercase font-[Inter,sans-serif] ${c.text}`}>
        {displayLabel}
      </span>
    </motion.div>
  );
}
