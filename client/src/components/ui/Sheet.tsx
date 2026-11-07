import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { CloseIcon } from "./Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export default function Sheet({ open, onClose, title, children }: Props) {
  // Drag-to-dismiss only from the header, so the body can still scroll.
  const dragControls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-h-[88dvh] overflow-y-auto glass rounded-t-[24px] bg-[#141418]/90 px-6 pt-2 pb-safe sm:max-w-md sm:rounded-[24px] sm:pb-6"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 500) && onClose()}
          >
            <div className="touch-none" onPointerDown={(e) => dragControls.start(e)}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            </div>
            <div className="mb-4 flex items-center justify-between touch-none pt-2" onPointerDown={(e) => dragControls.start(e)}>
              <h2 className="text-base font-semibold">{title}</h2>
              <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className="pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
