import { useEffect, useState } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import posthog from "posthog-js";
import AuthProvider from "@/contexts/AuthContext";
import { AuthGate } from "@/components/features/auth/AuthGate";
import { fetchCurrentUser } from "@/lib/api/auth-api";
import type { AuthUser } from "@/types/auth";
import { useAnalysisViewed } from "./use-analysis-viewed";
import { getAnalyticsEpoch, identifyUser, resetUser } from "./client";
import { flushExitSignals } from "./exit-signal";

vi.mock("posthog-js", () => ({ default: { __loaded: true, capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), _isIdentified: () => false } }));
vi.mock("@/lib/demo/state", () => ({ isDemoMode: () => false }));
vi.mock("@/lib/analytics/hash", () => ({ hashUserId: async () => "hashed-account" }));
vi.mock("@/lib/api/auth-api", () => ({ fetchCurrentUser: vi.fn(), logoutUser: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
let finishResult: (() => void) | undefined;
let epochAtMount: number;
function Result() {
  const [ready, setReady] = useState(false);
  useAnalysisViewed({ analysisId: "result-a", analysisType: "individual", ready });
  useEffect(() => { epochAtMount = getAnalyticsEpoch(); finishResult = () => setReady(true); }, []);
  return null;
}
beforeEach(() => { resetUser(); vi.clearAllMocks(); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
afterEach(() => { cleanup(); flushExitSignals(); });
it("observes ready body and legacy dwell when AuthProvider initially identifies after AuthGate mounts result", async () => {
  vi.mocked(fetchCurrentUser).mockResolvedValue({ account: { email: "initial@example.com" }, onboarded: true } as AuthUser);
  render(<AuthProvider><AuthGate><Result /></AuthGate></AuthProvider>);
  await waitFor(() => expect(posthog.identify).toHaveBeenCalledWith("hashed-account"));
  expect(getAnalyticsEpoch()).toBe(epochAtMount);
  await act(async () => finishResult?.());
  expect(posthog.capture).toHaveBeenCalledWith("analysis_result_viewed", expect.objectContaining({ analysis_id: "result-a" }));
  act(() => flushExitSignals());
  expect(posthog.capture).toHaveBeenCalledWith("analysis_viewed", expect.objectContaining({ analysis_id: "result-a" }), expect.any(Object));
});

it.each(["switch", "reset"])("still rejects a late ready body after a real identity %s", async (boundary) => {
  vi.mocked(fetchCurrentUser).mockResolvedValue({ account: { email: "initial@example.com" }, onboarded: true } as AuthUser);
  render(<AuthProvider><AuthGate><Result /></AuthGate></AuthProvider>);
  await waitFor(() => expect(posthog.identify).toHaveBeenCalledWith("hashed-account"));
  if (boundary === "switch") await identifyUser("other@example.com");
  else resetUser();
  await act(async () => finishResult?.());
  act(() => flushExitSignals());
  expect(posthog.capture).not.toHaveBeenCalled();
});
