import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import RootError from "./error";

/**
 * FRT-259 — (main) 바깥 세그먼트의 에러 경계.
 *
 * 이 화면은 앱이 터졌을 때만 보이므로 개발 중 사람 눈에 띄지 않는다.
 * 문구·role·복구 버튼이 조용히 사라지는 것을 막는 그물이다.
 */
afterEach(cleanup);

describe("app/error.tsx (루트 세그먼트 에러 경계)", () => {
  it("스크린리더가 즉시 읽도록 alert 역할로 한국어 안내를 띄운다", () => {
    render(<RootError error={new Error("boom")} reset={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "문제가 발생했어요" }),
    ).toBeInTheDocument();
  });

  it("'다시 시도'가 Next 의 reset 을 호출한다 — 복구 수단이 실제로 연결돼 있어야 한다", () => {
    const reset = vi.fn();
    render(<RootError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  // GNB 가 없는 자리(랜딩·로그인·데모)에 뜨므로 뷰포트 전체를 기준으로 세로 중앙 정렬해야
  // 한다. (main) 의 기본값(below-gnb)이 남으면 GNB 높이만큼 아래로 밀린다.
  // FullPageMessage 의 fill 계약(viewport → min-h-dvh)에 의존하는 단언이다.
  it("GNB 가 없는 자리이므로 뷰포트 전체 기준으로 정렬한다", () => {
    const { container } = render(
      <RootError error={new Error("boom")} reset={vi.fn()} />,
    );

    expect(container.querySelector(".min-h-dvh")).not.toBeNull();
  });

  it("에러 메시지·스택을 화면에 노출하지 않는다", () => {
    render(
      <RootError
        error={Object.assign(new Error("민감한 내부 스택"), { digest: "abc123" })}
        reset={vi.fn()}
      />,
    );

    expect(screen.queryByText(/민감한 내부 스택/)).not.toBeInTheDocument();
    expect(screen.queryByText(/abc123/)).not.toBeInTheDocument();
  });
});
