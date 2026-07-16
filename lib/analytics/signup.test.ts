import { beforeEach, describe, expect, it } from "vitest";

import { markSignupCompletedIfUnseen } from "@/lib/analytics/signup";

const USER = "user@example.com";
const OTHER = "other@example.com";

describe("markSignupCompletedIfUnseen — 가입 완료 1회 판정(FRT-19)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("첫 호출에서만 true(발화), 이후엔 false", async () => {
    expect(await markSignupCompletedIfUnseen(USER)).toBe(true);
    // 온보딩 중도 이탈 후 재로그인 — onboarded=false 로 같은 분기를 다시 타도 재발화 없음.
    expect(await markSignupCompletedIfUnseen(USER)).toBe(false);
    expect(await markSignupCompletedIfUnseen(USER)).toBe(false);
  });

  it("같은 기기의 다른 사용자는 자기 가입을 발화한다(마커가 사용자별)", async () => {
    expect(await markSignupCompletedIfUnseen(USER)).toBe(true);
    expect(await markSignupCompletedIfUnseen(OTHER)).toBe(true);
    expect(await markSignupCompletedIfUnseen(OTHER)).toBe(false);
  });

  it("사용자를 알 수 없으면 dedup 을 포기하고 발화한다", async () => {
    expect(await markSignupCompletedIfUnseen("")).toBe(true);
    expect(await markSignupCompletedIfUnseen("")).toBe(true);
  });

  it("원본 이메일은 저장하지 않고 해시 키만 남긴다", async () => {
    await markSignupCompletedIfUnseen(USER);
    const keys = Object.keys(window.localStorage);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^arc:signup_completed_emitted:[0-9a-f]{64}$/);
    expect(keys[0]).not.toContain(USER);
  });

  it("첫 기록 마커와 키가 겹치지 않는다", async () => {
    await markSignupCompletedIfUnseen(USER);
    const keys = Object.keys(window.localStorage);
    expect(keys.some((k) => k.startsWith("arc:first_record_emitted"))).toBe(false);
  });
});
