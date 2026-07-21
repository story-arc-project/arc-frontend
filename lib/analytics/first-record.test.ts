import { beforeEach, describe, expect, it } from "vitest";

import { markFirstRecordIfUnseen } from "@/lib/analytics/first-record";

const USER = "user@example.com";
const OTHER = "other@example.com";

describe("markFirstRecordIfUnseen — 첫 기록 1회 판정(FRT-19)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("count 가 1 이 아니면 발화하지 않는다", async () => {
    expect(await markFirstRecordIfUnseen(0, USER)).toBe(false);
    expect(await markFirstRecordIfUnseen(2, USER)).toBe(false);
    expect(await markFirstRecordIfUnseen(5, USER)).toBe(false);
  });

  it("count===1 이면 첫 호출에서만 true(발화), 이후엔 false", async () => {
    expect(await markFirstRecordIfUnseen(1, USER)).toBe(true);
    // 전체 삭제 후 재생성으로 다시 count===1 이 되어도 재발화하지 않는다.
    expect(await markFirstRecordIfUnseen(1, USER)).toBe(false);
  });

  it("같은 기기의 다른 사용자는 자기 첫 기록을 발화한다(마커가 사용자별)", async () => {
    expect(await markFirstRecordIfUnseen(1, USER)).toBe(true);
    expect(await markFirstRecordIfUnseen(1, OTHER)).toBe(true);
    // 각자 1회만.
    expect(await markFirstRecordIfUnseen(1, USER)).toBe(false);
    expect(await markFirstRecordIfUnseen(1, OTHER)).toBe(false);
  });

  it("사용자를 알 수 없으면 dedup 을 포기하고 발화한다(count===1 만으로 degrade)", async () => {
    expect(await markFirstRecordIfUnseen(1, "")).toBe(true);
    expect(await markFirstRecordIfUnseen(1, "")).toBe(true);
  });

  it("이메일 대소문자·공백이 달라도 같은 사용자로 본다", async () => {
    expect(await markFirstRecordIfUnseen(1, USER)).toBe(true);
    expect(await markFirstRecordIfUnseen(1, "  User@Example.COM  ")).toBe(false);
  });
});
