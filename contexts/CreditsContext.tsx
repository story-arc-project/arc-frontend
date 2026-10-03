"use client";

import { createContext, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCredits } from "@/lib/api/credits-api";
import { ApiError } from "@/lib/api/api-error";
import { CREDITS_INVALIDATED_EVENT } from "@/lib/credits/events";
import type { CreditsState } from "@/types/credits";

const initialState: CreditsState = {
  data: null, status: "idle", error: null, isRefreshing: false, isStale: false,
};

// One ephemeral store per authenticated generation; never persisted or shared across accounts.
class CreditsStore {
  private state = initialState;
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private pending: Promise<void> | null = null;
  private invalidated = false;

  constructor(private readonly enabled: boolean) {}

  getSnapshot = () => this.state;
  getServerSnapshot = () => initialState;

  private publish(state: CreditsState) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      if (this.enabled) this.listen(true);
      // Deferring the first read coalesces sibling mounts and StrictMode's setup/cleanup/setup.
      queueMicrotask(() => { if (this.listeners.size) void this.read(); });
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        this.listen(false);
        queueMicrotask(() => {
          if (this.listeners.size) return;
          this.controller?.abort();
          this.controller = null;
          this.pending = null;
          this.invalidated = false;
          this.state = initialState;
        });
      }
    };
  };

  private onReturn = () => {
    if (document.visibilityState === "visible") this.onInvalidate();
  };

  private onInvalidate = () => {
    void this.refetch();
  };

  private listen(add: boolean) {
    const method = add ? "addEventListener" : "removeEventListener";
    window[method]("focus", this.onReturn);
    window[method]("online", this.onInvalidate);
    document[method]("visibilitychange", this.onReturn);
    window[method](CREDITS_INVALIDATED_EVENT, this.onInvalidate);
  }

  refetch = (): Promise<void> => {
    if (!this.enabled || !this.listeners.size) return Promise.resolve();
    // An explicit refresh may follow a mutation; a read already in flight is not fresh enough.
    this.invalidated = true;
    this.publish({ ...this.state, isStale: true });
    return this.read();
  };

  private read = (): Promise<void> => {
    if (!this.enabled || !this.listeners.size) return Promise.resolve();
    if (this.pending) return this.pending;
    const controller = new AbortController();
    this.controller = controller;
    const current = () => this.controller === controller && !controller.signal.aborted && this.listeners.size > 0;
    // The whole drain is shared by callers, including a queued invalidation read.
    this.pending = Promise.resolve().then(async () => {
      do {
        this.invalidated = false;
        if (!current()) break;
        this.publish({ ...this.state, status: this.state.data ? "success" : "loading", error: null, isRefreshing: !!this.state.data });
        try {
          const data = await getCredits(controller.signal);
          if (current()) this.publish({ data, status: "success", error: null, isRefreshing: false, isStale: this.invalidated });
        } catch (cause) {
          if (current()) this.publish({
            ...this.state,
            status: cause instanceof ApiError && (cause.status === 404 || cause.status === 501) ? "unavailable" : "error",
            error: cause instanceof Error ? cause : new Error("크레딧을 불러오지 못했어요."),
            isRefreshing: false, isStale: !!this.state.data || this.invalidated,
          });
        }
      } while (current() && this.invalidated);
    }).finally(() => {
      if (this.controller === controller) {
        this.controller = null;
        this.pending = null;
        if (this.invalidated && this.listeners.size) return this.read();
      }
    });
    return this.pending;
  };
}

export const CreditsContext = createContext<CreditsStore | null>(null);

export default function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const account = !isLoading ? user?.account.email : undefined;
  // Replace the store during render, before consumers can see a previous account's snapshot.
  // Keep the child tree mounted so auth revalidation cannot discard in-progress forms.
  const store = useMemo(() => new CreditsStore(!!account), [account]);
  return <CreditsContext.Provider value={store}>{children}</CreditsContext.Provider>;
}
