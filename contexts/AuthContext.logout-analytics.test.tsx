import { StrictMode, useContext, type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuthProvider, { AuthContext } from "./AuthContext";
import { fetchCurrentUser, logoutUser } from "@/lib/api/auth-api";
import { capture } from "@/lib/analytics/client";
import { hashUserId } from "@/lib/analytics/hash";
import { useAnalysisViewed } from "@/lib/analytics/use-analysis-viewed";
import { useArchiveEntryAnalytics } from "@/lib/analytics/use-archive-entry";
import { useDwell } from "@/lib/analytics/use-dwell";
import { useFlowExit } from "@/lib/analytics/use-flow-exit";
import { useExitSignal } from "@/lib/analytics/exit-signal";
import type { AuthUser } from "@/types/auth";

const sdk = vi.hoisted(() => ({
  id: "anonymous",
  events: [] as { event: string; distinct_id: string; props: unknown; options: unknown }[],
  order: [] as string[],
  assign: vi.fn(),
}));
vi.mock("@/lib/api/auth-api", () => ({ fetchCurrentUser: vi.fn(), logoutUser: vi.fn() }));
vi.mock("posthog-js", () => ({
  default: {
  __loaded: true,
  identify: (id: string) => {
    sdk.id = id;
  },
  _isIdentified: () => sdk.id !== "anonymous",
  reset: () => {
    sdk.order.push("reset");
    sdk.id = "anonymous";
    // Model navigation while listeners are still mounted, before React commits.
    window.dispatchEvent(new Event("pagehide"));
  },
  capture: (event: string, props: unknown, options: unknown) => {
    sdk.order.push(event);
    sdk.events.push({ event, distinct_id: sdk.id, props, options });
  },
  },
}));

const user = (email: string) => ({
  account: { email },
  onboarded: true,
}) as AuthUser;
const emit = () => capture("onboarding_abandoned", { last_step: "q1", elapsed_seconds: 3 }, { atUnload: true });
function visible(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

beforeEach(() => {
  sdk.id = "anonymous";
  sdk.events = [];
  sdk.order = [];
  vi.clearAllMocks();
  vi.mocked(fetchCurrentUser).mockResolvedValue(user("a@example.com"));
  vi.mocked(logoutUser).mockResolvedValue(undefined);
  vi.stubGlobal("location", { assign: sdk.assign, pathname: "/dashboard" });
  visible("visible");
});
afterEach(async () => {
  cleanup();
  await settle();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  visible("visible");
});

async function mount(options: { hidden?: boolean; strict?: boolean } = {}) {
  if (options.hidden) visible("hidden");
  const wrapper = ({ children }: { children: ReactNode }) => options.strict
    ? <StrictMode><AuthProvider>{children}</AuthProvider></StrictMode>
    : <AuthProvider>{children}</AuthProvider>;
  const hook = renderHook(({ show, callback }) => {
    const auth = useContext(AuthContext)!;
    useDwell({ active: show && auth.isAuthenticated, onLeave: callback });
    const flow = useFlowExit({ active: show && auth.isAuthenticated, onExit: emit });
    return { auth, flow };
  }, { wrapper, initialProps: { show: true, callback: emit } });
  await waitFor(() => expect(sdk.id).toMatch(/^[a-f0-9]{64}$/));
  return hook;
}

describe("explicit logout retains the departing analytics identity (FRT-330)", () => {
  it("flushes dwell and flow under A before reset, deduplicates pagehide/unmount, and isolates B", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const renderScreen = () => renderHook(() => {
      const auth = useContext(AuthContext)!;
      useAnalysisViewed({ analysisType: "individual", analysisId: "analysis-1", ready: auth.isAuthenticated });
      const archive = useArchiveEntryAnalytics({ mode: "edit", active: auth.isAuthenticated });
      return { auth, archive };
    }, { wrapper });
    const hook = renderScreen();
    await waitFor(() => expect(sdk.id).toMatch(/^[a-f0-9]{64}$/));
    act(() => hook.result.current.archive.handleCompletionChange({
      sectionIds: ["situation", "action", "result"],
      completedSectionIds: ["situation"],
      qualitativeFieldsFilled: ["role"],
    }));
    clock.mockReturnValue(105_000);
    const a = await hashUserId("a@example.com");
    await act(() => hook.result.current.auth.logout());
    expect(sdk.events).toEqual([
      {
        event: "analysis_viewed",
        distinct_id: a,
        props: { analysis_type: "individual", analysis_id: "analysis-1", view_duration_seconds: 5 },
        options: { transport: "sendBeacon", send_instantly: true },
      },
      {
        event: "archive_entry_abandoned",
        distinct_id: a,
        props: {
          mode: "edit",
          last_section: "situation",
          sections_done: 1,
          sections_total: 3,
          elapsed_seconds: 5,
          qualitative_fields_filled: ["role"],
        },
        options: { transport: "sendBeacon", send_instantly: true },
      },
    ]);
    expect(sdk.order).toEqual(["analysis_viewed", "archive_entry_abandoned", "reset"]);
    expect(sdk.assign).toHaveBeenCalledWith("/login");
    act(() => window.dispatchEvent(new Event("pagehide")));
    hook.unmount();
    await settle();
    expect(sdk.events).toHaveLength(2);
    vi.mocked(fetchCurrentUser).mockResolvedValue(user("b@example.com"));
    const bHook = renderScreen();
    await waitFor(() => expect(sdk.id).not.toBe("anonymous"));
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(sdk.events.slice(2)).toHaveLength(2);
    expect(sdk.events.slice(2).every((event) => event.distinct_id === sdk.id)).toBe(true);
    expect(sdk.id).toBe(await hashUserId("b@example.com"));
    expect(sdk.events[3].props).toMatchObject({ sections_done: 0, sections_total: 0, qualitative_fields_filled: [] });
    bHook.unmount();
  });

  it("flushes an unmounted signal before its deferred timer settles", async () => {
    const hook = await mount();
    const logout = hook.result.current.auth.logout;
    hook.unmount();
    await act(() => logout());
    await settle();
    expect(sdk.events).toHaveLength(2);
    expect(sdk.events.every((event) => event.distinct_id !== "anonymous")).toBe(true);
    expect(sdk.order.at(-1)).toBe("reset");
  });

  it("keeps pending and rejected logout sessions intact", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(logoutUser).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    const hook = await mount();
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.auth.logout();
    });
    expect(sdk.events).toHaveLength(0);
    expect(sdk.order).toHaveLength(0);
    await act(async () => {
      reject(new Error("offline"));
      await pending;
    });
    expect(hook.result.current.auth.isAuthenticated).toBe(true);
    expect(sdk.assign).not.toHaveBeenCalled();
    expect(sdk.order).toHaveLength(0);
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(sdk.events).toHaveLength(2);
  });

  it("does not emit completed flows or hidden-never-viewed dwell", async () => {
    const hook = await mount({ hidden: true });
    act(() => hook.result.current.flow.markCompleted());
    await act(() => hook.result.current.auth.logout());
    act(() => {
      visible("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(sdk.events).toHaveLength(0);
    expect(sdk.order).toEqual(["reset"]);
  });

  it("retains deferred inactive cleanup through logout and uses latest callbacks in StrictMode", async () => {
    const hook = await mount({ strict: true });
    const latest = vi.fn(emit);
    hook.rerender({ show: true, callback: latest });
    hook.rerender({ show: false, callback: latest });
    await act(() => hook.result.current.auth.logout());
    await settle();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(sdk.events).toHaveLength(2);
    expect(sdk.events.every((event) => event.distinct_id !== "anonymous")).toBe(true);
    expect(sdk.order.at(-1)).toBe("reset");
  });

  it("isolates callback failures and closes vetoed and failed sessions before reset", async () => {
    let allow = false;
    const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const hook = renderHook(() => {
      const auth = useContext(AuthContext)!;
      useExitSignal({
        active: auth.isAuthenticated,
        onHidden: false,
        shouldFire: () => {
          if (sdk.id !== "anonymous") throw new Error("guard");
          return true;
        },
        onFire: emit,
      });
      useExitSignal({ active: auth.isAuthenticated, onHidden: false, shouldFire: () => allow, onFire: emit });
      useDwell({ active: false, onLeave: emit });
      useDwell({
        active: auth.isAuthenticated,
        onLeave: () => {
          if (sdk.id !== "anonymous") throw new Error("capture");
        },
      });
      useFlowExit({ active: auth.isAuthenticated, onExit: emit });
      return auth;
    }, { wrapper });
    await waitFor(() => expect(sdk.id).not.toBe("anonymous"));
    await act(() => hook.result.current.logout());
    allow = true;
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(sdk.events).toHaveLength(1);
    expect(sdk.order).toEqual(["onboarding_abandoned", "reset"]);
    expect(sdk.assign).toHaveBeenCalledWith("/login");
  });
});
