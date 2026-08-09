import { useState } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Education } from "@/types/resume";
import { EducationListEditor } from "./EducationListEditor";

afterEach(cleanup);

const edu = (patch: Partial<Education> = {}): Education => ({
  id: 1,
  학교명: "한국대학교",
  학과: null,
  전공구분: null,
  학위: null,
  입학년월: null,
  졸업년월: null,
  졸업구분: null,
  학점: null,
  만점: null,
  비고: null,
  ...patch,
});

// 편집기는 controlled 라 onChange 스파이만으로는 "값이 실제로 남았는가"를 못 본다.
// 부모 상태를 그대로 되먹여, 화면에 보이는 값과 상태 양쪽을 함께 검증한다.
function Harness({ initial }: { initial: Education[] }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <EducationListEditor value={value} onChange={setValue} />
      <span data-testid="학점-상태">{String(value[0].학점)}</span>
      <span data-testid="만점-상태">{String(value[0].만점)}</span>
      <input aria-label="다른 칸" />
    </>
  );
}

const 학점칸 = () => screen.getByLabelText("학점") as HTMLInputElement;
const 만점칸 = () => screen.getByLabelText("만점") as HTMLInputElement;
const 학점상태 = () => screen.getByTestId("학점-상태").textContent;
const 만점상태 = () => screen.getByTestId("만점-상태").textContent;

// FRT-224 — GpaInput 은 "타이핑 중인가"를 로컬 raw 로 추적하는데, onBlur 가 raw===null
// (= 한 번도 타이핑하지 않음)까지 null 로 계산해 부모에 써버렸다. 포커스만 스쳐도 저장돼
// 있던 학점이 조용히 지워진다. 편집하지 않았으면 아무것도 쓰지 않아야 한다.
describe("GpaInput — 편집하지 않은 포커스는 값을 건드리지 않는다", () => {
  it("학점 칸에 포커스만 줬다 벗어나도 저장된 값이 남는다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[edu({ 학점: 3.5 })]} />);

    await user.click(학점칸());
    await user.click(screen.getByLabelText("다른 칸"));

    expect(학점상태()).toBe("3.5");
    expect(학점칸().value).toBe("3.5");
  });

  it("만점 칸도 포커스만으로는 지워지지 않는다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[edu({ 만점: 4.5 })]} />);

    await user.click(만점칸());
    await user.click(screen.getByLabelText("다른 칸"));

    expect(만점상태()).toBe("4.5");
    expect(만점칸().value).toBe("4.5");
  });

  it("한 번 편집해 확정한 뒤 다시 포커스만 줘도 값이 남는다", async () => {
    // blur 가 raw 를 null 로 되돌리므로, 편집 직후의 재포커스도 같은 경로를 탄다.
    const user = userEvent.setup();
    render(<Harness initial={[edu({ 학점: 3.5 })]} />);

    await user.clear(학점칸());
    await user.type(학점칸(), "4.2");
    await user.click(screen.getByLabelText("다른 칸"));
    expect(학점상태()).toBe("4.2");

    await user.click(학점칸());
    await user.click(screen.getByLabelText("다른 칸"));

    expect(학점상태()).toBe("4.2");
  });

  it("Tab 으로 학점 칸을 그냥 지나가도 값이 남는다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[edu({ 학점: 3.5, 만점: 4.5 })]} />);

    학점칸().focus();
    await user.tab();

    expect(학점상태()).toBe("3.5");
  });
});

describe("GpaInput — 실제 편집은 그대로 반영된다", () => {
  it("타이핑한 값이 부모에 반영되고 blur 후에도 유지된다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[edu()]} />);

    await user.type(학점칸(), "3.75");
    expect(학점상태()).toBe("3.75");

    await user.click(screen.getByLabelText("다른 칸"));
    expect(학점상태()).toBe("3.75");
  });

  it("소수점만 찍고 벗어나면 정수로 확정된다", async () => {
    // "3." 은 타이핑 도중 유효한 중간 상태라 onChange 를 미루고, blur 에서 3 으로 굳힌다.
    const user = userEvent.setup();
    render(<Harness initial={[edu()]} />);

    await user.type(학점칸(), "3.");
    await user.click(screen.getByLabelText("다른 칸"));

    expect(학점상태()).toBe("3");
  });

  it("사용자가 값을 비우면 null 로 지워진다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[edu({ 학점: 3.5 })]} />);

    await user.clear(학점칸());
    await user.click(screen.getByLabelText("다른 칸"));

    expect(학점상태()).toBe("null");
  });

  it("숫자로 읽을 수 없는 입력은 blur 에서 null 로 정리된다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[edu({ 학점: 3.5 })]} />);

    await user.clear(학점칸());
    await user.type(학점칸(), "가나다");
    await user.click(screen.getByLabelText("다른 칸"));

    expect(학점상태()).toBe("null");
  });
});
