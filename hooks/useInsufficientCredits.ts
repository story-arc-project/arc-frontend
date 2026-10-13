"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { isInsufficientCredits } from "@/lib/credits/insufficient-credits";

/** Local to the paid operation. A superseded or unmounted attempt cannot reopen UI. */
export function useInsufficientCredits(scope: unknown = true) {
  const [open, setOpen] = useState(false);
  const [trackedScope, setTrackedScope] = useState(scope);
  if (trackedScope !== scope) {
    setTrackedScope(scope);
    setOpen(false);
  }
  const generation = useRef(0);
  const initiatingElement = useRef<HTMLElement | null>(null);
  const mounted = useRef(false);
  // Invalidate during commit, before promises can run ahead of passive cleanup.
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [scope]);
  const onClose = useCallback(() => {
    setOpen(false);
    // Busy buttons may blur before the response. Restore the initiator captured
    // before submission, after Dialog has performed its own close cleanup.
    const element = initiatingElement.current;
    requestAnimationFrame(() => {
      if (element?.isConnected) element.focus();
    });
  }, []);
  const beginAttempt = useCallback(() => {
    const attempt = ++generation.current;
    initiatingElement.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const isCurrent = () => mounted.current && generation.current === attempt;
    const handleError = (error: unknown) => {
      // Consume stale errors too, so callers do not replace current UI with an old failure.
      if (!isCurrent()) return true;
      if (!isInsufficientCredits(error)) return false;
      setOpen(true);
      return true;
    };
    return Object.assign(handleError, { isCurrent });
  }, []);
  return { open, onClose, beginAttempt };
}
