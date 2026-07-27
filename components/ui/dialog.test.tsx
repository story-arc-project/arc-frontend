import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { Dialog } from "./dialog";

afterEach(cleanup);

/**
 * 포커스 복원은 두 가지 방식으로 닫힌다.
 *
 * ① `open={false}` 를 받으며 마운트를 유지 — 원래부터 지원하던 경로.
 * ② 호출부가 `{open && <Dialog …/>}` 로 **조건부 렌더** — Dialog 는 open=false 를 한 번도
 *    받지 못한 채 사라진다. 이때 복원이 없으면 포커스가 <body> 로 떨어져, 키보드 사용자는
 *    모달을 닫는 순간 화면에서 자기 위치를 잃는다(FRT-109 에서 실제로 만든 회귀).
 */
function Harness({ open, mounted }: { open: boolean; mounted: boolean }) {
  return (
    <>
      <button type="button">열기</button>
      {mounted && (
        <Dialog open={open} onClose={() => {}} ariaLabel="테스트 모달">
          <button type="button">확인</button>
        </Dialog>
      )}
    </>
  );
}

function openFrom(rerender: (ui: React.ReactElement) => void) {
  const opener = screen.getByRole("button", { name: "열기" });
  opener.focus();
  rerender(<Harness open mounted />);

  // 실제 브라우저라면 Dialog 가 모달 안 첫 요소로 포커스를 옮긴다. jsdom 은 offsetParent 가
  // 항상 null 이라 getFocusable 이 아무것도 못 찾으므로 그 이동을 여기서 대신 만든다 —
  // 포커스가 모달 안에 있어야 "돌아왔다"가 의미를 갖는다.
  screen.getByRole("button", { name: "확인" }).focus();
  return opener;
}

describe("Dialog — 닫을 때 포커스 복원", () => {
  it("조건부 렌더로 언마운트돼 닫혀도 열었던 요소로 돌아온다", () => {
    const { rerender } = render(<Harness open mounted={false} />);
    const opener = openFrom(rerender);

    rerender(<Harness open mounted={false} />);

    expect(document.activeElement).toBe(opener);
  });

  it("마운트를 유지한 채 open=false 를 받는 기존 경로도 그대로 복원한다", () => {
    const { rerender } = render(<Harness open mounted={false} />);
    const opener = openFrom(rerender);

    rerender(<Harness open={false} mounted />);

    expect(document.activeElement).toBe(opener);
  });

  it("open=false 로 복원한 뒤 언마운트돼도 포커스를 다시 옮기지 않는다", () => {
    const { rerender } = render(<Harness open mounted={false} />);
    openFrom(rerender);

    rerender(<Harness open={false} mounted />);
    // 닫힌 뒤 사용자가 다른 곳으로 이동한 상태를 만든다.
    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    rerender(<Harness open={false} mounted={false} />);

    // 언마운트 복원이 이미 끝난 복원을 한 번 더 하면 사용자를 뒤로 끌어당긴다.
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });
});
