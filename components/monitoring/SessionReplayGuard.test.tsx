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

  it("admin 을 벗어나도 다시 켜지 않는다(의도된 절충)", () => {
    // 재개하면 뒤로가기로 `?q=고객이메일` 로 돌아올 때 Replay 의 history 리스너가 그 주소를
    // 동기적으로 기록하고 stop() 이 그걸 flush 해 전송한다 — effect 로는 못 이긴다(Codex P1).
    nav.pathname = "/admin/customers";
    const { rerender } = render(<SessionReplayGuard />);

    nav.pathname = "/dashboard";
    rerender(<SessionReplayGuard />);
    expect(sentry.start).not.toHaveBeenCalled();
  });

  it("admin 안에서 이동해도 켜지 않는다", () => {
    nav.pathname = "/admin";
    const { rerender } = render(<SessionReplayGuard />);
    nav.pathname = "/admin/customers";
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
