import { describe, it, expect } from "vitest";

import { visibleExperiences } from "@/lib/export/resume-visibility";

interface Item {
  id: number;
  표시?: boolean;
  표시순위?: number | null;
}

const at = (items: Item[]) => items.map((i) => i.id);

describe("visibleExperiences", () => {
  it("표시 필드가 어떤 항목에도 없으면 입력을 그대로 돌려준다", () => {
    // 백엔드가 rev.5 를 구현하기 전 상태. 여기서 하나라도 걸러지면 현행 레쥬메가 조용히 줄어든다.
    const items: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(visibleExperiences(items)).toEqual(items);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const items: Item[] = [{ id: 1 }, { id: 2 }];
    visibleExperiences(items);
    expect(at(items)).toEqual([1, 2]);
  });

  it("표시가 하나라도 있으면 표시=false 를 걸러내고 표시순위 오름차순으로 정렬한다", () => {
    const items: Item[] = [
      { id: 1, 표시: true, 표시순위: 3 },
      { id: 2, 표시: false, 표시순위: null },
      { id: 3, 표시: true, 표시순위: 1 },
      { id: 4, 표시: true, 표시순위: 2 },
    ];
    expect(at(visibleExperiences(items))).toEqual([3, 4, 1]);
  });

  it("표시가 일부 항목에만 있으면 표시가 없는 항목은 남긴다", () => {
    // 부분적으로만 태그된 응답에서 태그 없는 항목을 숨기면 경험이 통째로 사라진다.
    // 숨기는 근거는 명시적인 `표시: false` 뿐이다.
    const items: Item[] = [
      { id: 1, 표시: true, 표시순위: 2 },
      { id: 2 },
      { id: 3, 표시: false },
    ];
    expect(at(visibleExperiences(items))).toEqual([1, 2]);
  });

  it("표시순위가 없는 항목은 뒤로 밀고 원래 순서를 지킨다", () => {
    const items: Item[] = [
      { id: 1, 표시: true },
      { id: 2, 표시: true, 표시순위: 5 },
      { id: 3, 표시: true, 표시순위: null },
      { id: 4, 표시: true, 표시순위: 1 },
    ];
    expect(at(visibleExperiences(items))).toEqual([4, 2, 1, 3]);
  });

  it("표시순위가 같으면 원래 순서를 지킨다(안정 정렬)", () => {
    const items: Item[] = [
      { id: 1, 표시: true, 표시순위: 1 },
      { id: 2, 표시: true, 표시순위: 1 },
      { id: 3, 표시: true, 표시순위: 1 },
    ];
    expect(at(visibleExperiences(items))).toEqual([1, 2, 3]);
  });

  it("전부 표시=false 면 빈 배열이다", () => {
    const items: Item[] = [
      { id: 1, 표시: false },
      { id: 2, 표시: false },
    ];
    expect(visibleExperiences(items)).toEqual([]);
  });

  it("빈 배열과 부재를 견딘다", () => {
    expect(visibleExperiences([])).toEqual([]);
    expect(visibleExperiences(undefined)).toEqual([]);
    expect(visibleExperiences(null)).toEqual([]);
  });
});
