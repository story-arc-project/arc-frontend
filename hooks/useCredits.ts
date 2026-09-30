"use client";

import { useContext, useSyncExternalStore } from "react";
import { CreditsContext } from "@/contexts/CreditsContext";

export function useCredits() {
  const store = useContext(CreditsContext);
  if (!store) throw new Error("useCredits must be used within CreditsProvider");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...state, refetch: store.refetch };
}
