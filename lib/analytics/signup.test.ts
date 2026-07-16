import { beforeEach, describe, expect, it } from "vitest";

import {
  markSignupCompletedIfUnseen,
  clearSignupMarker,
} from "@/lib/analytics/signup";

describe("markSignupCompletedIfUnseen — 가입 완료 1회 판정(FRT-19)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("첫 호출에서만 true(발화), 이후엔 false", () => {
    expect(markSignupCompletedIfUnseen()).toBe(true);
    // 온보딩 중도 이탈 후 재로그인 — onboarded=false 로 같은 분기를 다시 타도 재발화 없음.
    expect(markSignupCompletedIfUnseen()).toBe(false);
    expect(markSignupCompletedIfUnseen()).toBe(false);
  });

  it("clearSignupMarker 이후엔 다시 발화할 수 있다(같은 기기의 다음 사용자 대비)", () => {
    expect(markSignupCompletedIfUnseen()).toBe(true);
    clearSignupMarker();
    expect(markSignupCompletedIfUnseen()).toBe(true);
  });

  it("첫 기록 마커와 키가 겹치지 않는다", () => {
    markSignupCompletedIfUnseen();
    expect(window.localStorage.getItem("arc:first_record_emitted")).toBeNull();
    expect(window.localStorage.getItem("arc:signup_completed_emitted")).toBe("1");
  });
});
