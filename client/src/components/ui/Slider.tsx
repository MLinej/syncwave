import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface Props {
  value: number;
  max: number;
  /** Fired continuously while dragging (optional). */
  onChange?: (value: number) => void;
  /** Fired once when the user lets go. */
  onCommit: (value: number) => void;
  disabled?: boolean;
  step?: number;
  /** Tooltip text while scrubbing; omit for no tooltip. */
  format?: (value: number) => string;
  ariaLabel: string;
  ariaValueText?: string;
  className?: string;
}

/**
 * Music-player slider: a 4px track that grows to 8px on hover, an accent
 * fill, and a thumb that only appears on hover or while dragging.
 */
export default function Slider({ value, max, onChange, onCommit, disabled, step = 1, format, ariaLabel, ariaValueText, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;
  const pct = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0;

  const valueAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * max;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || max <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = valueAt(e.clientX);
    setDrag(v);
    onChange?.(v);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const v = valueAt(e.clientX);
    setDrag(v);
    onChange?.(v);
  };
  const onPointerUp = () => {
    if (drag === null) return;
    onCommit(drag);
    setDrag(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : 0;
    if (!delta) return;
    e.preventDefault();
    onCommit(Math.min(max, Math.max(0, value + delta)));
  };

  const active = drag !== null;

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={ariaValueText}
      aria-disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={`group relative flex h-6 touch-none items-center rounded-full outline-none ${disabled ? "" : "cursor-pointer"} ${className}`}
    >
      <div
        className={`relative w-full overflow-hidden rounded-full bg-white/15 transition-[height] duration-200 ${
          active ? "h-2" : "h-1"
        } ${disabled ? "" : "group-hover:h-2 group-focus-visible:h-2"}`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      {!disabled && (
        <div
          className={`pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_35%,transparent),0_2px_8px_rgb(0_0_0/0.4)] transition-[opacity,transform] duration-150 ${
            active ? "scale-110 opacity-100" : "scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
          style={{ left: `${pct}%` }}
        />
      )}
      {format && active && (
        <div
          className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-[8px] bg-white px-2 py-1 text-sm font-semibold text-[#0a0a0c] tabular-nums shadow-lg"
          style={{ left: `${pct}%` }}
        >
          {format(shown)}
        </div>
      )}
    </div>
  );
}
