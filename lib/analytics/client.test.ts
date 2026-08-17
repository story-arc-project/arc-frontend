import { beforeEach, describe, expect, it, vi } from "vitest";

import posthog from "posthog-js";

import { isDemoMode } from "@/lib/demo/state";
import {
  capture,
  identifyUser,
  isIdentified,
  markInternalUser,
  resetUser,
} from "@/lib/analytics/client";
import { hashUserId } from "@/lib/analytics/hash";

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    _isIdentified: vi.fn(() => false),
    setPersonProperties: vi.fn(),
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
  _isIdentified: ReturnType<typeof vi.fn>;
  setPersonProperties: ReturnType<typeof vi.fn>;
};

// 실제 posthog 는 identify 이후 _isIdentified() 가 true 가 된다 — mock 에서도 그 전이를 재현해야
// "식별 전 보류 → identify 직후 전송" 순서를 검증할 수 있다.
function identifyFlipsIdentifiedFlag(): void {
  ph.identify.mockImplementation(() => {
    ph._isIdentified.mockReturnValue(true);
  });
}

describe("analytics client — capture/identify/reset 가드(FRT-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ph.__loaded = true;
    ph._isIdentified.mockReturnValue(false);
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

  it("isIdentified 는 posthog 의 식별 여부를 그대로 전달한다(익명 방문자=false)", () => {
    ph._isIdentified.mockReturnValue(false);
    expect(isIdentified()).toBe(false);
    ph._isIdentified.mockReturnValue(true);
    expect(isIdentified()).toBe(true);
  });

  it("비활성 상태의 isIdentified 는 posthog 를 건드리지 않고 false", () => {
    ph.__loaded = false;
    ph._isIdentified.mockReturnValue(true);
    expect(isIdentified()).toBe(false);
    expect(ph._isIdentified).not.toHaveBeenCalled();
  });

  it("identify 해시 대기 중 resetUser 가 끼어들면 stale identify 를 취소한다", async () => {
    const pending = identifyUser("user@example.com"); // 해시 await 지점에서 양보
    resetUser(); // identifyToken 증가 → 진행 중 identify 무효화
    await pending;
    expect(ph.identify).not.toHaveBeenCalled();
    expect(ph.reset).toHaveBeenCalledTimes(1);
  });
});

// FRT-139: 팀 계정 행동을 지표에서 제외한다.
// 전송을 막는 대신 person 에 `$internal_or_test_user` 를 심어, PostHog 가 이 용도로 제공하는
// 내부/테스트 사용자 필터(프로젝트 test_account_filters → 코호트)가 그대로 걸리게 한다.
// 차단이 아니라 표식이라 되돌릴 수 있다(필터만 끄면 팀 행동도 다시 보인다).
describe("analytics client — 내부 사용자 표식(FRT-139)", () => {
  beforeEach(() => {
    // 표식 상태는 모듈 레벨이라 테스트 간에 새어나간다 — reset 으로 먼저 비운 뒤 mock 을 지운다.
    ph.__loaded = true;
    vi.mocked(isDemoMode).mockReturnValue(false);
    resetUser();
    vi.clearAllMocks();
    ph._isIdentified.mockReturnValue(false);
  });

  it("이미 식별된 사용자에게는 즉시 내부 표식을 심는다", () => {
    ph._isIdentified.mockReturnValue(true);
    markInternalUser();
    expect(ph.setPersonProperties).toHaveBeenCalledWith({ $internal_or_test_user: true });
  });

  it("아직 식별 전이면 보류했다가 identifyUser 직후에 심는다", async () => {
    identifyFlipsIdentifiedFlag();

    // 판정(/api/admin/status)이 identify 보다 먼저 끝나는 순서 — 익명 상태에선 person 이 없어
    // (identified_only) 표식이 붙을 곳이 없다.
    markInternalUser();
    expect(ph.setPersonProperties).not.toHaveBeenCalled();

    await identifyUser("team@story-arc.org");
    expect(ph.setPersonProperties).toHaveBeenCalledWith({ $internal_or_test_user: true });
  });

  it("PostHog 미초기화면 표식을 심지 않는다", () => {
    ph.__loaded = false;
    ph._isIdentified.mockReturnValue(true);
    markInternalUser();
    expect(ph.setPersonProperties).not.toHaveBeenCalled();
  });

  it("데모 모드에서는 표식을 심지 않는다", () => {
    vi.mocked(isDemoMode).mockReturnValue(true);
    ph._isIdentified.mockReturnValue(true);
    markInternalUser();
    expect(ph.setPersonProperties).not.toHaveBeenCalled();
  });

  it("같은 사용자에게 두 번 심지 않는다(마운트마다 $set 이벤트가 늘지 않게)", () => {
    ph._isIdentified.mockReturnValue(true);
    markInternalUser();
    markInternalUser();
    markInternalUser();
    expect(ph.setPersonProperties).toHaveBeenCalledTimes(1);
  });

  it("로그아웃하면 보류된 표식이 다음 사용자에게 붙지 않는다", async () => {
    identifyFlipsIdentifiedFlag();

    markInternalUser(); // 팀원 판정은 났지만 아직 식별 전 — 보류 상태
    resetUser(); // 로그아웃: 보류를 버려야 한다
    ph._isIdentified.mockReturnValue(false);

    await identifyUser("someone-else@example.com");
    expect(ph.setPersonProperties).not.toHaveBeenCalled();
  });

  it("로그아웃 뒤 다시 팀원으로 판정되면 표식을 새로 심는다", () => {
    ph._isIdentified.mockReturnValue(true);
    markInternalUser();
    resetUser();
    vi.clearAllMocks();
    ph._isIdentified.mockReturnValue(true);

    markInternalUser();
    expect(ph.setPersonProperties).toHaveBeenCalledWith({ $internal_or_test_user: true });
  });
});
