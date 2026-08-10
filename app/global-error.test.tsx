import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import GlobalError from "./global-error";

/**
 * FRT-259 — 루트 레이아웃 자체가 던졌을 때의 마지막 경계.
 *
 * 이 컴포넌트는 루트 레이아웃을 대체하므로 <html>/<body> 를 직접 렌더한다.
 * React 19 는 이들을 렌더 컨테이너에 중첩하지 않고 실제 문서(documentElement·body·head)에
 * 병합하므로, 그 속성들을 document 에서 직접 조회해 검증한다.
 *
 * '새로고침' 버튼이 실제로 문서를 다시 요청하는지는 여기서 검증하지 않는다 —
 * jsdom 의 location 스텁이 불안정해서다. 그 근거는 프로덕션 빌드에 회귀를 주입해
 * 실제 화면을 띄우고, 클릭 전에 심은 window 마커가 사라지는 것으로 확인했다(PR 본문 참고).
 */
afterEach(cleanup);

describe("app/global-error.tsx (루트 레이아웃 에러 경계)", () => {
  it("스크린리더가 즉시 읽도록 alert 역할로 한국어 안내를 띄운다", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "문제가 발생했어요" }),
    ).toBeInTheDocument();
  });

  it("복구 수단으로 '새로고침' 버튼을 제공한다", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "새로고침" }),
    ).toBeInTheDocument();
  });

  it("루트 레이아웃을 대체하므로 문서의 html·body 속성을 스스로 세운다", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);

    // React 19 는 <html>/<body> 를 컨테이너에 중첩하지 않고 실제 문서에 병합한다.
    expect(document.documentElement.getAttribute("lang")).toBe("ko");
    expect(document.documentElement.className).toContain("h-full");
    expect(document.body.className).toContain("min-h-full");
  });

  it("layout.tsx 가 대체되므로 폰트·타이틀을 스스로 다시 붙인다", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);

    expect(document.title).toBe("ARC");
    expect(
      document.head.querySelector('link[href*="pretendard"]'),
    ).not.toBeNull();
  });

  it("에러 메시지·digest 를 화면에 노출하지 않는다", () => {
    render(
      <GlobalError
        error={Object.assign(new Error("민감한 내부 스택"), { digest: "abc123" })}
        reset={vi.fn()}
      />,
    );

    expect(screen.queryByText(/민감한 내부 스택/)).not.toBeInTheDocument();
    expect(screen.queryByText(/abc123/)).not.toBeInTheDocument();
  });
});
