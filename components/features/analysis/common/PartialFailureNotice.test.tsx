import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PartialFailureNotice, { describePartialFailure } from "./PartialFailureNotice";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

describe("PartialFailureNotice", () => {
  it("안내 문구를 alert 으로 알린다 — 조용히 지나가면 안 되는 정보다", () => {
    render(<PartialFailureNotice message="키워드 분석 정보를 불러오지 못했어요." />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "키워드 분석 정보를 불러오지 못했어요.",
    );
  });

  it("다시 시도를 누르면 재조회를 요청한다", async () => {
    const onRetry = vi.fn();
    render(<PartialFailureNotice message="못 불러왔어요." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("재조회 수단이 없으면 버튼을 띄우지 않는다 — 눌러도 아무 일 없는 버튼은 두지 않는다", () => {
    render(<PartialFailureNotice message="못 불러왔어요." />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("다시 시도는 모바일 44px 터치 타깃을 지킨다 (FRT-63)", () => {
    render(<PartialFailureNotice message="못 불러왔어요." onRetry={() => {}} />);

    expect(screen.getByRole("button", { name: "다시 시도" })).toHaveClass("min-h-11");
  });
});

describe("describePartialFailure", () => {
  it("실패가 없으면 null 이다 — 호출부는 이 값으로 노출 여부를 정한다", () => {
    expect(describePartialFailure([], false)).toBeNull();
  });

  it("실패한 분석 유형을 이름으로 말한다 — '일부'로는 오인을 못 끊는다", () => {
    expect(describePartialFailure(["comprehensive"], false)).toBe(
      "종합 분석 정보를 불러오지 못했어요. 화면의 숫자가 실제와 다를 수 있어요.",
    );
  });

  it("여러 유형이 실패하면 선언 순서 그대로 나열한다", () => {
    expect(describePartialFailure(["individual", "keyword"], false)).toContain(
      "개별 분석·키워드 분석",
    );
  });

  it("경험 목록 실패도 함께 말한다 — 전체 경험 수가 0으로 보이는 이유다", () => {
    expect(describePartialFailure(["keyword"], true)).toContain("키워드 분석·경험 목록");
  });

  it("경험 목록만 실패해도 안내한다", () => {
    expect(describePartialFailure([], true)).toContain("경험 목록");
  });
});
