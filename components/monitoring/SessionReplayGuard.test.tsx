import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
const sentry = vi.hoisted(() => ({
  stop: vi.fn(async () => {}),
  start: vi.fn(),
  replay: true,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

vi.mock("@sentry/nextjs", () => ({
  getReplay: () =>
    sentry.replay ? { stop: sentry.stop, start: sentry.start } : undefined,
}));

import { SessionReplayGuard } from "./SessionReplayGuard";

beforeEach(() => {
  nav.pathname = "/dashboard";
  sentry.replay = true;
  sentry.stop.mockClear();
  sentry.start.mockClear();
});

// globals:false 라 자동 cleanup 이 없다(.claude/rules/testing.md).
afterEach(() => {
  cleanup();
});

describe("SessionReplayGuard", () => {
  it("admin 밖에서는 녹화를 건드리지 않는다", () => {
    render(<SessionReplayGuard />);
    expect(sentry.stop).not.toHaveBeenCalled();
    expect(sentry.start).not.toHaveBeenCalled();
  });

  it("admin 에 들어가면 녹화를 멈춘다", () => {
    nav.pathname = "/admin/customers";
    render(<SessionReplayGuard />);
    expect(sentry.stop).toHaveBeenCalled();
  });

  it("admin 을 벗어나면 녹화를 다시 켠다", () => {
    // 끄고 끝내면 SPA 세션이 새로고침 전까지 Replay 없이 남는다(Codex P2).
    nav.pathname = "/admin/customers";
    const { rerender } = render(<SessionReplayGuard />);
    expect(sentry.start).not.toHaveBeenCalled();

    nav.pathname = "/dashboard";
    rerender(<SessionReplayGuard />);
    expect(sentry.start).toHaveBeenCalledTimes(1);
  });

  it("admin 안에서 이동해도 다시 켜지 않는다", () => {
    nav.pathname = "/admin";
    const { rerender } = render(<SessionReplayGuard />);
    nav.pathname = "/admin/customers";
    rerender(<SessionReplayGuard />);
    expect(sentry.start).not.toHaveBeenCalled();
  });

  it("우리가 끈 적 없으면 임의로 켜지 않는다", () => {
    nav.pathname = "/dashboard";
    const { rerender } = render(<SessionReplayGuard />);
    nav.pathname = "/archive";
    rerender(<SessionReplayGuard />);
    expect(sentry.start).not.toHaveBeenCalled();
  });

  it("Replay 통합이 없으면 아무 것도 하지 않는다", () => {
    sentry.replay = false;
    nav.pathname = "/admin/customers";
    expect(() => render(<SessionReplayGuard />)).not.toThrow();
    expect(sentry.stop).not.toHaveBeenCalled();
  });
});
