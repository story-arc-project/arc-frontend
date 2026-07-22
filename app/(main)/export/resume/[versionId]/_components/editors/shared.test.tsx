import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { EditorSelect } from "./shared";

afterEach(cleanup);

// enum 드리프트 방어. 백엔드 생성 프롬프트의 선택지가 프런트 옵션과 갈라지면(FRT-109 에서
// 실제로 자격구분·단체구분이 그랬다) 현재 값을 담은 <option> 이 없어 select 가 빈 칸처럼
// 보이고, 사용자는 미리보기에 보이는 자기 값을 편집기에서 다시 고를 수 없었다.
describe("EditorSelect — 옵션 밖 값 보존", () => {
  it("현재 값이 options 에 없으면 그 값을 옵션으로 함께 렌더한다", () => {
    render(
      <EditorSelect
        options={["국가자격", "민간자격"]}
        value="구-자격증"
        onChange={() => {}}
        aria-label="자격구분"
      />,
    );

    const select = screen.getByLabelText("자격구분") as HTMLSelectElement;
    // 값이 실제로 선택된 상태로 보여야 한다 — 옵션이 없으면 selectedIndex 가 -1 로 빈 칸이 된다.
    expect(select.value).toBe("구-자격증");
    expect(
      Array.from(select.options).map((o) => o.value),
    ).toContain("구-자격증");
  });

  it("값이 options 안에 있으면 옵션을 중복 추가하지 않는다", () => {
    render(
      <EditorSelect
        options={["국가자격", "민간자격"]}
        value="국가자격"
        onChange={() => {}}
        aria-label="자격구분"
      />,
    );

    const select = screen.getByLabelText("자격구분") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values.filter((v) => v === "국가자격")).toHaveLength(1);
    // 빈 값(선택 안 함) + 옵션 2개
    expect(values).toHaveLength(3);
  });

  it("값이 비어 있으면(선택 안 함) 옵션을 늘리지 않는다", () => {
    render(
      <EditorSelect
        options={["국가자격", "민간자격"]}
        value=""
        onChange={() => {}}
        aria-label="자격구분"
      />,
    );

    const select = screen.getByLabelText("자격구분") as HTMLSelectElement;
    expect(Array.from(select.options)).toHaveLength(3);
    expect(select.value).toBe("");
  });
});
