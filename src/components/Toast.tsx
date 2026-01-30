import { motion, AnimatePresence } from "framer-motion";

type ToastTone = "default" | "alert" | "success";

export function Toast({ message, show, tone = "default", position = "bottom" }: { message: string; show: boolean; tone?: ToastTone; position?: "top" | "bottom" }) {
  const toneClass = tone === "alert" ? " toast-alert" : tone === "success" ? " toast-success" : "";
  const posClass = position === "top" ? " toast-top" : "";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`toast${toneClass}${posClass}`}
          initial={{ opacity: 0, y: position === "top" ? -12 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === "top" ? -10 : 10 }}
          transition={{ duration: 0.2 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
