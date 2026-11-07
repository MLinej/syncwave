import { hueOf, initials } from "@/utils/format";

interface Props {
  name: string;
  size?: number;
  dim?: boolean;
  /** Accent ring (used for the host). */
  ring?: boolean;
  /** Small presence dot in the corner. */
  status?: "ready" | "offline" | "busy" | null;
}

export default function Avatar({ name, size = 40, dim = false, ring = false, status = null }: Props) {
  const hue = hueOf(name);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={`grid size-full place-items-center rounded-full font-semibold text-white ${ring ? "ring-2 ring-accent ring-offset-2 ring-offset-[#0a0a0c]" : ""} ${
          dim ? "opacity-50" : ""
        }`}
        style={{ fontSize: Math.round(size * 0.38), background: `hsl(${hue} 40% 34%)` }}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      {status && (
        <span
          className={`absolute right-0 bottom-0 rounded-full ring-2 ring-[#0a0a0c] ${
            status === "ready" ? "bg-ok" : status === "busy" ? "bg-warn" : "bg-white/40"
          }`}
          style={{ width: Math.max(8, size * 0.26), height: Math.max(8, size * 0.26) }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
