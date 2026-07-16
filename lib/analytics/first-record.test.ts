import { beforeEach, describe, expect, it } from "vitest";

import {
  markFirstRecordIfUnseen,
  clearFirstRecordMarker,
} from "@/lib/analytics/first-record";

describe("markFirstRecordIfUnseen — 첫 기록 1회 판정(FRT-19)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("count 가 1 이 아니면 발화하지 않는다", () => {
    expect(markFirstRecordIfUnseen(0)).toBe(false);
    expect(markFirstRecordIfUnseen(2)).toBe(false);
    expect(markFirstRecordIfUnseen(5)).toBe(false);
  });

  it("count===1 이면 첫 호출에서만 true(발화), 이후엔 false", () => {
    expect(markFirstRecordIfUnseen(1)).toBe(true);
    // 전체 삭제 후 재생성으로 다시 count===1 이 되어도 재발화하지 않는다.
    expect(markFirstRecordIfUnseen(1)).toBe(false);
  });

  it("clearFirstRecordMarker 이후엔 다시 첫 기록으로 발화할 수 있다(다른 사용자 로그인 대비)", () => {
    expect(markFirstRecordIfUnseen(1)).toBe(true);
    clearFirstRecordMarker();
    expect(markFirstRecordIfUnseen(1)).toBe(true);
  });
});
