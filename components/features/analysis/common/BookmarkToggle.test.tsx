import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import BookmarkToggle from "./BookmarkToggle";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

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
