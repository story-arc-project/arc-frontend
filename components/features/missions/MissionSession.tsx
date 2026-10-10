"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MissionStore } from "@/lib/missions/store";
import type { MissionAdapter } from "@/lib/missions/types";

const SessionContext = createContext<MissionStore | null>(null);

/** Put above list/detail navigation. Change key on auth generation; never persist evidence to disk. */
export function MissionSession({ accountId, adapter, onClaimed, children }: {
  accountId: string; adapter: MissionAdapter; onClaimed: () => void | Promise<void>; children: ReactNode;
}) {
  return <AccountSession key={accountId} adapter={adapter} onClaimed={onClaimed}>{children}</AccountSession>;
}
function AccountSession({ adapter, onClaimed, children }: Omit<Parameters<typeof MissionSession>[0], "accountId">) {
  const [store] = useState(() => new MissionStore(adapter, onClaimed));
  useEffect(() => {
    const release = store.retain();
    // StrictMode replays setup/cleanup before microtasks run. Only the retained
    // setup starts a load, so an initial failure never becomes an implicit retry.
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void store.load(); });
    return () => { cancelled = true; release(); };
  }, [store]);
  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>;
}
export function useMissionSession() {
  const store = useContext(SessionContext);
  if (!store) throw new Error("MissionSession is required");
  return store;
}
