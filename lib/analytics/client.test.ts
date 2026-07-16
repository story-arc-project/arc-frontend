import { beforeEach, describe, expect, it, vi } from "vitest";

import posthog from "posthog-js";

import { isDemoMode } from "@/lib/demo/state";
import { capture, identifyUser, resetUser } from "@/lib/analytics/client";
import { hashUserId } from "@/lib/analytics/hash";

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("@/lib/demo/state", () => ({
  isDemoMode: vi.fn(() => false),
}));

const ph = posthog as unknown as {
  __loaded: boolean;
  capture: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

describe("analytics client — capture/identify/reset 가드(FRT-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ph.__loaded = true;
    vi.mocked(isDemoMode).mockReturnValue(false);
  });

  it("활성 상태에서 이벤트를 이름·속성 그대로 전송한다", () => {
    capture("onboarding_completed", {});
    capture("record_created", { experience_type: "society", status: "complete" });
    expect(ph.capture).toHaveBeenCalledWith("onboarding_completed", {});
    expect(ph.capture).toHaveBeenCalledWith("record_created", {
      experience_type: "society",
      status: "complete",
    });
  });

  it("PostHog 미초기화(__loaded=false)면 아무것도 전송하지 않는다", () => {
    ph.__loaded = false;
    capture("signup_completed", { method: "email" });
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("데모 모드에서는 실제 사용자가 아니므로 전송하지 않는다", () => {
    vi.mocked(isDemoMode).mockReturnValue(true);
    capture("signup_completed", { method: "google" });
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("identifyUser 는 원본 이메일이 아닌 해시를 distinct_id 로 넘긴다", async () => {
    await identifyUser("user@example.com");
    const expected = await hashUserId("user@example.com");
    expect(ph.identify).toHaveBeenCalledWith(expected);
    expect(ph.identify).not.toHaveBeenCalledWith(
      expect.stringContaining("user@example.com"),
    );
  });

  it("빈 이메일이면 identify 하지 않는다", async () => {
    await identifyUser("");
    expect(ph.identify).not.toHaveBeenCalled();
  });

  it("비활성 상태에서는 identify/reset 모두 no-op", async () => {
    ph.__loaded = false;
    await identifyUser("user@example.com");
    resetUser();
    expect(ph.identify).not.toHaveBeenCalled();
    expect(ph.reset).not.toHaveBeenCalled();
  });

  it("resetUser 는 활성 상태에서 posthog.reset 을 호출한다", () => {
    resetUser();
    expect(ph.reset).toHaveBeenCalledTimes(1);
  });

  it("identify 해시 대기 중 resetUser 가 끼어들면 stale identify 를 취소한다", async () => {
    const pending = identifyUser("user@example.com"); // 해시 await 지점에서 양보
    resetUser(); // identifyToken 증가 → 진행 중 identify 무효화
    await pending;
    expect(ph.identify).not.toHaveBeenCalled();
    expect(ph.reset).toHaveBeenCalledTimes(1);
  });
});
