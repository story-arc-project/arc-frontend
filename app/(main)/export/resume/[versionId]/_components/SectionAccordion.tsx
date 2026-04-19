"use client";

import { ReactNode, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface SectionAccordionProps {
  title: string;
  itemCount?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SectionAccordion({
  title,
  itemCount,
  defaultOpen = false,
  children,
}: SectionAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-semibold text-text-primary">
            {title}
          </span>
          {typeof itemCount === "number" && itemCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-brand px-1.5 text-caption font-medium text-brand-dark">
              {itemCount}
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-text-tertiary"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            id={panelId}
          className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
