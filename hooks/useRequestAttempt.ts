"use client";

import { useCallback, useRef } from "react";
import { ApiError } from "@/lib/api/client";
import { isInsufficientCredits } from "@/lib/credits/insufficient-credits";

/** One mounted, account-scoped operation. Ambiguous failures keep their payload/key. */
export function useRequestAttempt<T>() {
  const current = useRef<{ key: string; fingerprint: string; payload: T } | null>(null);
  const begin = useCallback((payload: T) => {
    const fingerprint = JSON.stringify(payload);
    if (!current.current || current.current.fingerprint !== fingerprint) {
      current.current = { key: crypto.randomUUID(), fingerprint, payload: JSON.parse(fingerprint) as T };
    }
    return current.current;
  }, []);
  const reject = useCallback((key: string, error: unknown) => {
    if (current.current?.key === key && (isInsufficientCredits(error) || (error instanceof ApiError && error.status === 422))) {
      current.current = null;
    }
  }, []);
  const reset = useCallback(() => { current.current = null; }, []);
  return { begin, reject, reset };
}
