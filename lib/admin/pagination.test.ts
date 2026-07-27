import { describe, expect, it } from "vitest";

import { getPageRange, getPageWindow } from "./pagination";

describe("getPageRange", () => {
  it("전체 0건이면 from·to 는 0, totalPages 는 1", () => {
    expect(getPageRange(0, 20, 1)).toEqual({ totalPages: 1, from: 0, to: 0 });
  });

  it("첫 페이지 범위를 1-based 로 준다", () => {
    expect(getPageRange(137, 20, 1)).toEqual({ totalPages: 7, from: 1, to: 20 });
  });

  it("중간 페이지 범위", () => {
    expect(getPageRange(137, 20, 3)).toEqual({ totalPages: 7, from: 41, to: 60 });
  });

  it("마지막 페이지는 to 가 전체 건수로 잘린다", () => {
    expect(getPageRange(137, 20, 7)).toEqual({
      totalPages: 7,
      from: 121,
      to: 137,
    });
  });

  it("범위를 벗어난 page 는 마지막 페이지로 클램프한다", () => {
    expect(getPageRange(30, 20, 99)).toEqual({ totalPages: 2, from: 21, to: 30 });
  });

  it("딱 나누어떨어지면 마지막 페이지 to 가 전체와 같다", () => {
    expect(getPageRange(40, 20, 2)).toEqual({ totalPages: 2, from: 21, to: 40 });
  });
});

describe("getPageWindow", () => {
  it("전체가 창보다 작으면 전부 나열한다", () => {
    expect(getPageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it("중앙이면 현재 좌우로 span 개씩", () => {
    expect(getPageWindow(5, 10, 2)).toEqual([3, 4, 5, 6, 7]);
  });

  it("앞 경계에서 개수가 줄지 않고 오른쪽으로 확장한다", () => {
    expect(getPageWindow(1, 10, 2)).toEqual([1, 2, 3, 4, 5]);
  });

  it("뒤 경계에서 개수가 줄지 않고 왼쪽으로 확장한다", () => {
    expect(getPageWindow(10, 10, 2)).toEqual([6, 7, 8, 9, 10]);
  });

  it("totalPages 0 이면 빈 배열", () => {
    expect(getPageWindow(1, 0)).toEqual([]);
  });
});
