import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { useEffect } from "react";

export default function Toast() {
  const { error, setError } = useApp();

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [error, setError]);

  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-[120px] left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-6 py-3 rounded-full shadow-lg font-[Inter,sans-serif] font-medium flex items-center gap-2"
        >
          <span className="text-xl">⚠️</span>
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
