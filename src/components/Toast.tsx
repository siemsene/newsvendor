import { motion, AnimatePresence } from "framer-motion";

type ToastTone = "default" | "alert";

export function Toast({ message, show, tone = "default" }: { message: string; show: boolean; tone?: ToastTone }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`toast${tone === "alert" ? " toast-alert" : ""}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
