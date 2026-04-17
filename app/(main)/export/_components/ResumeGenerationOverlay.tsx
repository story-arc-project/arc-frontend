"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const MESSAGES = [
  "경험을 읽고 있어요…",
  "섹션을 구성하고 있어요…",
  "내용을 정리하고 있어요…",
  "마지막 점검 중이에요…",
];

const ROTATE_MS = 4000;

interface ResumeGenerationOverlayProps {
  open: boolean;
}

export function ResumeGenerationOverlay({ open }: ResumeGenerationOverlayProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-6 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-brand text-brand"
            >
              <Sparkles size={24} />
            </motion.div>

            <div className="relative h-7 w-[260px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-x-0 text-body text-white font-medium"
                >
                  {MESSAGES[index]}
                </motion.p>
              </AnimatePresence>
            </div>

            <p className="text-caption text-white/70 max-w-xs">
              AI가 레쥬메를 만드는 데 5~30초 정도 걸릴 수 있어요.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
