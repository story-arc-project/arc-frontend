"use client";
import { useSyncExternalStore } from "react";
import type { MissionStore } from "./store";
import type { MissionState } from "./types";
export function useMissions(store: MissionStore): MissionState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
