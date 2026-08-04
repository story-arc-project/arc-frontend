import { describe, expect, it } from "vitest";

import {
  formatActivityStatusBreakdown,
  getActivityStatusLabel,
  getCustomerStatusMeta,
} from "./customer-status";

describe("getCustomerStatusMeta", () => {
  // 백엔드 users.status 는 실재 enum 이 unverified|verified 두 값뿐이다(arc-backend dev
  // db/models.py UserStatus). FRT-16 이 임시로 쓰던 active/dormant/suspended/withdrawn 은
  // 백엔드에 존재하지 않는다 — 그 값들을 아는 척하면 화면이 있지도 않은 상태를 라벨링한다.
  it("이메일 미인증 상태를 라벨·색과 함께 준다", () => {
    expect(getCustomerStatusMeta("unverified")).toEqual({
      label: "인증 전",
      variant: "warning",
    });
  });

  it("이메일 인증 완료 상태를 라벨·색과 함께 준다", () => {
    expect(getCustomerStatusMeta("verified")).toEqual({
      label: "인증됨",
      variant: "success",
    });
  });

  // 백엔드가 나중에 값을 늘려도 화면이 조용히 틀린 라벨을 붙이면 안 된다. 모르는 코드는
  // null 을 돌려 호출부가 **원문 그대로** 노출하게 한다(추측 금지).
  it("모르는 상태 코드는 null 을 돌려준다", () => {
    expect(getCustomerStatusMeta("dormant")).toBeNull();
    expect(getCustomerStatusMeta("suspended")).toBeNull();
    expect(getCustomerStatusMeta("active")).toBeNull();
    expect(getCustomerStatusMeta("휴면")).toBeNull();
  });

  it("빈 문자열도 null 로 다룬다", () => {
    expect(getCustomerStatusMeta("")).toBeNull();
  });

  // 프로토타입 오염 방어 — Record 조회가 상속 프로퍼티를 주워오면 "constructor" 같은 입력이
  // 객체를 반환해 렌더가 깨진다.
  it("Object 프로토타입 키를 상태로 오인하지 않는다", () => {
    expect(getCustomerStatusMeta("constructor")).toBeNull();
    expect(getCustomerStatusMeta("toString")).toBeNull();
  });
});

describe("getActivityStatusLabel", () => {
  it("분석·이력서 상태에 한국어 라벨을 준다", () => {
    expect(getActivityStatusLabel("success")).toBe("성공");
    expect(getActivityStatusLabel("failed")).toBe("실패");
    expect(getActivityStatusLabel("queued")).toBe("진행 중");
    expect(getActivityStatusLabel("pending")).toBe("대기");
  });

  it("모르는 상태는 원문을 그대로 돌려준다", () => {
    expect(getActivityStatusLabel("retrying")).toBe("retrying");
  });
});

describe("formatActivityStatusBreakdown", () => {
  it("성공·실패를 고정 순서로 한 줄에 담는다", () => {
    // 서버가 준 키 순서를 그대로 쓰면 실패 건수의 위치가 새로고침마다 바뀐다.
    expect(formatActivityStatusBreakdown({ failed: 1, success: 7 })).toBe(
      "성공 7 · 실패 1",
    );
  });

  it("0 건인 상태는 생략한다", () => {
    expect(
      formatActivityStatusBreakdown({ success: 4, failed: 0, queued: 0 }),
    ).toBe("성공 4");
  });

  it("표시할 게 하나도 없으면 null", () => {
    expect(formatActivityStatusBreakdown({})).toBeNull();
    expect(formatActivityStatusBreakdown({ success: 0 })).toBeNull();
    expect(formatActivityStatusBreakdown(null)).toBeNull();
    expect(formatActivityStatusBreakdown(undefined)).toBeNull();
  });

  it("모르는 상태도 아는 상태 뒤에 이어 붙인다", () => {
    expect(
      formatActivityStatusBreakdown({ retrying: 2, success: 1 }),
    ).toBe("성공 1 · retrying 2");
  });
});
