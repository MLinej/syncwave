import type { ReactNode } from "react";

/** Lightweight hover/focus tooltip (desktop); touch users rely on aria-labels. */
export default function Tooltip({ label, children, side = "bottom" }: { label: string; children: ReactNode; side?: "top" | "bottom" }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-[8px] bg-white px-2 py-1 text-sm font-semibold whitespace-nowrap text-[#0a0a0c] opacity-0 shadow-lg transition-opacity duration-150 group-hover/tt:opacity-100 group-has-[:focus-visible]/tt:opacity-100 ${
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
        }`}
      >
        {label}
      </span>
    </span>
  );
}
