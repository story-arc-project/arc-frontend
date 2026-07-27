"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

// 자소서 파이프라인의 실제 단계를 그대로 말한다(명세 PART 2: 회사 리서치 → 문항별 집필 →
// 근거 검증 → 교정 → 다듬기). 진행 상황을 지어내지 않으면 기다림이 덜 불안하다.
const MESSAGES = [
  "회사를 알아보고 있어요…",
  "문항별로 초안을 쓰고 있어요…",
  "기록에 근거한 내용인지 확인하고 있어요…",
  "문장을 다듬고 있어요…",
];

const ROTATE_MS = 4000;

interface CoverLetterGenerationOverlayProps {
  open: boolean;
}

export function CoverLetterGenerationOverlay({
  open,
}: CoverLetterGenerationOverlayProps) {
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-6 backdrop-blur-sm"
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

            <div className="relative h-7 w-[280px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-x-0 text-body font-medium text-white"
                >
                  {MESSAGES[index]}
                </motion.p>
              </AnimatePresence>
            </div>

            <p className="max-w-xs text-caption text-white/70">
              문항 수에 따라 30초 이상 걸릴 수 있어요.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
