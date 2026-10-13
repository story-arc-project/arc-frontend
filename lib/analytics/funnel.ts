import { isDemoMode } from "@/lib/demo/state";
import { capture } from "./client";
import type { AnalyticsEventProps } from "./events";
import type { EntryPath, FunnelPayloads } from "./funnel-events";
export type { EntryPath, FunnelContext, FunnelPayloads } from "./funnel-events";

export function newFunnelId(): string { return crypto.randomUUID(); }

/** Never pass referrers, query values or arbitrary user text to analytics. */
export function sanitizeFunnelEntry(value: string): EntryPath {
  switch (value) {
    case "charge_page": case "insufficient_credits": case "settings":
    case "fake_door": case "direct": return value;
    default: return "unknown";
  }
}

/** Best effort only: collection failure must not change the outcome of a user action.
 * No local first-exposure flag: account-wide truth requires BAC-89.
 * Internal users retain the existing $internal_or_test_user dashboard filter.
 */
export function captureFunnel<E extends keyof FunnelPayloads>(event: E, props: FunnelPayloads[E]): void {
  try {
    if (process.env.NEXT_PUBLIC_FUNNEL_DEPLOYMENT !== "production") return;
    if (process.env.NODE_ENV !== "production" || typeof window === "undefined" || isDemoMode()) return;
    if (window.location.pathname === "/dev" || window.location.pathname.startsWith("/dev/") || window.location.pathname === "/iframe.html") return;
    capture(event, {
      ...props,
      event_id: newFunnelId(),
      schema_version: 1,
      occurred_at: new Date().toISOString(),
      environment: "production",
    } as AnalyticsEventProps[E]);
  } catch {
    // No retry here: SDK delivery is not backend storage or a committed business fact.
  }
}
