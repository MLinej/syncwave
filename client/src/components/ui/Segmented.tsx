import { motion } from "framer-motion";

interface Option<T extends string> {
  id: T;
  label: string;
  count?: number;
}

/** Segmented control with a highlight pill that slides between options. */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className = "",
}: {
  options: Option<T>[];
  value: T;
  onChange: (id: T) => void;
  layoutId: string;
  className?: string;
}) {
  return (
    <div className={`flex rounded-[16px] bg-white/[0.06] p-1 ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`relative flex h-9 flex-1 items-center justify-center gap-2 rounded-[12px] text-sm font-semibold transition-colors ${
              active ? "text-ink" : "text-ink/60 hover:text-ink/90"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[12px] bg-white/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                transition={{ type: "spring", damping: 30, stiffness: 380 }}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && o.count > 0 && (
              <span
                className={`relative grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums ${
                  active ? "bg-accent text-[#0a0a0c]" : "bg-white/10 text-ink/80"
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
