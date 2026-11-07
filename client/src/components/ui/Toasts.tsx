import { AnimatePresence, motion } from "framer-motion";
import { dismissToast, toastStore, useStore } from "@/state/store";
import { CheckIcon, CloseIcon } from "./Icons";

export default function Toasts() {
  const toasts = useStore(toastStore, (s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => dismissToast(t.id)}
            className="glass pointer-events-auto flex max-w-sm items-center gap-2 rounded-[16px] bg-[#1a1a1f]/80 py-2 pr-4 pl-2 text-left text-sm font-semibold text-ink"
          >
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full ${
                t.kind === "error" ? "bg-danger/20 text-danger" : t.kind === "success" ? "bg-ok/20 text-ok" : "bg-accent/20 text-accent"
              }`}
            >
              {t.kind === "error" ? <CloseIcon size={13} strokeWidth={2.6} /> : <CheckIcon size={13} strokeWidth={2.6} />}
            </span>
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
