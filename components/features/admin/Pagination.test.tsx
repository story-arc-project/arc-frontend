import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Pagination } from "./Pagination";

// globals:false 라 자동 cleanup 이 없다(.claude/rules/testing.md).
afterEach(() => {
  cleanup();
});

function nextButton() {
  return screen.getByRole("button", { name: "다음 페이지" });
}

describe("Pagination — 전체 건수를 아는 경우", () => {
  it("총계와 현재 범위를 함께 알린다", () => {
    render(
      <Pagination
        page={2}
        pageSize={20}
        totalCount={137}
        pageItemCount={20}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText(/총 137명 중 21–40/)).toBeTruthy();
  });

  it("마지막 페이지에서 다음 버튼을 막는다", () => {
    render(
      <Pagination
        page={7}
        pageSize={20}
        totalCount={137}
        pageItemCount={17}
        onPageChange={() => {}}
      />,
    );
    expect(nextButton().hasAttribute("disabled")).toBe(true);
  });
});

describe("Pagination — 전체 건수를 모르는 경우(서버가 count 미제공)", () => {
  it("총계를 지어내지 않고 현재 범위만 말한다", () => {
    render(
      <Pagination
        page={2}
        pageSize={20}
        totalCount={null}
        pageItemCount={20}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText(/21–40번째 표시 중/)).toBeTruthy();
    expect(screen.queryByText(/총 /)).toBeNull();
  });

  it("페이지가 꽉 찼으면 다음 페이지로 갈 수 있어야 한다", () => {
    // 여기서 다음을 막으면 남은 결과가 통째로 도달 불가능해진다(Codex P2).
    render(
      <Pagination
        page={1}
        pageSize={20}
        totalCount={null}
        pageItemCount={20}
        onPageChange={() => {}}
      />,
    );
    expect(nextButton().hasAttribute("disabled")).toBe(false);
  });

  it("페이지가 덜 찼으면 마지막으로 보고 다음을 막는다", () => {
    render(
      <Pagination
        page={3}
        pageSize={20}
        totalCount={null}
        pageItemCount={7}
        onPageChange={() => {}}
      />,
    );
    expect(nextButton().hasAttribute("disabled")).toBe(true);
  });

  it("페이지 수를 모르므로 번호 버튼은 내지 않는다", () => {
    render(
      <Pagination
        page={1}
        pageSize={20}
        totalCount={null}
        pageItemCount={20}
        onPageChange={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "1" })).toBeNull();
  });

  it("항목이 없으면 범위 대신 없음을 알린다", () => {
    render(
      <Pagination
        page={1}
        pageSize={20}
        totalCount={null}
        pageItemCount={0}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("표시할 항목 없음")).toBeTruthy();
  });
});

describe("Pagination — 다음 버튼 동작", () => {
  it("총계 미상에서도 다음 페이지 번호로 콜백한다", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={2}
        pageSize={20}
        totalCount={null}
        pageItemCount={20}
        onPageChange={onPageChange}
      />,
    );
    nextButton().click();
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
