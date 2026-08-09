import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import BookmarkToggle from "./BookmarkToggle";

// useBasePath 를 통째로 mock 하지 않는다 — 그러면 "훅을 쓰는가"만 보이고
// "데모 URL 에서 실제로 /demo 로 판별되는가"를 못 본다(FRT-161). usePathname 만 갈아끼운다.
const mockUsePathname = vi.fn(() => "/analysis");
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

beforeEach(() => {
  mockUsePathname.mockReturnValue("/analysis");
});

describe("BookmarkToggle prop 동기화 (FRT-55)", () => {
  it("초기 isBookmarked=false 면 '즐겨찾기' 라벨", () => {
    render(<BookmarkToggle analysisId="a-1" isBookmarked={false} />);
    expect(screen.getByRole("button", { name: "즐겨찾기" })).toBeInTheDocument();
  });

  it("같은 인스턴스에서 isBookmarked prop 이 갱신되면 라벨도 따라간다 (stale 회귀 가드)", () => {
    const { rerender } = render(
      <BookmarkToggle analysisId="a-1" isBookmarked={false} />,
    );
    expect(screen.getByRole("button", { name: "즐겨찾기" })).toBeInTheDocument();

    // loadData 재호출로 부모 items 가 서버 상태(true)로 갱신된 상황을 모사.
    rerender(<BookmarkToggle analysisId="a-1" isBookmarked={true} />);
    expect(screen.getByRole("button", { name: "즐겨찾기 해제" })).toBeInTheDocument();
  });
});

describe("데모 모드에서는 즐겨찾기를 내보내지 않는다 (FRT-232)", () => {
  // 분석 영역은 아카이브와 달리 인메모리 store 가 없어(lib/api/mocks/analysis.ts 재사용)
  // 토글이 화면에서만 바뀌고 재조회하면 되살아난다 — 가짜 성공을 아예 만들지 않는다.
  it("데모 경로면 버튼 자체가 렌더되지 않는다", () => {
    mockUsePathname.mockReturnValue("/demo/analysis/history");
    render(<BookmarkToggle analysisId="a-1" isBookmarked={false} />);
    expect(screen.queryByRole("button", { name: "즐겨찾기" })).toBeNull();
  });

  it("이미 즐겨찾기된 항목이어도 데모에서는 해제 버튼이 없다", () => {
    mockUsePathname.mockReturnValue("/demo/analysis/bookmarks");
    render(<BookmarkToggle analysisId="a-1" isBookmarked={true} />);
    expect(screen.queryByRole("button", { name: "즐겨찾기 해제" })).toBeNull();
  });

  it("일반 모드에서는 그대로 렌더된다 (거울상 — 숨김이 전역으로 새지 않았는지)", () => {
    mockUsePathname.mockReturnValue("/analysis/history");
    render(<BookmarkToggle analysisId="a-1" isBookmarked={false} />);
    expect(screen.getByRole("button", { name: "즐겨찾기" })).toBeInTheDocument();
  });
});
