export default function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-ink">
      <img src="/logo-192.png" alt="" width={40} height={40} className="size-10 shrink-0 drop-shadow-[0_2px_6px_rgb(0_0_0/0.4)]" />
      {compact ? <span className="sr-only">SyncWave</span> : "SyncWave"}
    </span>
  );
}
