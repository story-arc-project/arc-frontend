import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import userEvent from "@testing-library/user-event";
import { render, cleanup, fireEvent, act } from "@testing-library/react";

import { Textarea } from "./textarea";

// jsdom 은 레이아웃이 없어 `scrollHeight` 가 늘 0이다. 실제 브라우저 계약 중 이 테스트가 기대는
// 부분만 흉내낸다: 내용 높이는 줄 수에 비례하고, 테두리는 위아래 1px 씩이다.
// 핵심 단언은 "높이 = scrollHeight + 테두리" — `box-sizing: border-box` 아래서 테두리를 되돌려 주지
// 않으면 마지막 줄이 2px 잘린다(FRT-327).
const LINE_PX = 20;
const BORDER_PX = 1;

const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "scrollHeight");
const originalGetComputedStyle = window.getComputedStyle;

Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
  configurable: true,
  get(this: HTMLTextAreaElement) {
    return LINE_PX * this.value.split("\n").length;
  },
});
window.getComputedStyle = ((el: Element) => {
  const base = originalGetComputedStyle(el);
  if (el instanceof HTMLTextAreaElement) {
    return new Proxy(base, {
      get(target, prop) {
        if (prop === "borderTopWidth" || prop === "borderBottomWidth") return `${BORDER_PX}px`;
        return Reflect.get(target, prop);
      },
    });
  }
  return base;
}) as typeof window.getComputedStyle;

afterEach(cleanup);
afterAll(() => {
  if (originalScrollHeight) {
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", originalScrollHeight);
  }
  window.getComputedStyle = originalGetComputedStyle;
});

function heightOf(el: HTMLTextAreaElement) {
  return parseFloat(el.style.height);
}

describe("Textarea 자동 높이", () => {
  it("제어 값이 바뀌면 내용 높이 + 테두리만큼 늘어난다", () => {
    const { getByRole, rerender } = render(<Textarea value="a" onChange={() => {}} />);
    const el = getByRole("textbox") as HTMLTextAreaElement;
    expect(heightOf(el)).toBe(LINE_PX * 1 + BORDER_PX * 2);

    rerender(<Textarea value={"a\nb\nc"} onChange={() => {}} />);
    expect(heightOf(el)).toBe(LINE_PX * 3 + BORDER_PX * 2);
  });

  it("defaultValue 로 마운트해도 처음부터 내용 높이에 맞춰져 있다", () => {
    const { getByRole } = render(<Textarea defaultValue={"a\nb\nc\nd"} />);
    const el = getByRole("textbox") as HTMLTextAreaElement;
    expect(heightOf(el)).toBe(LINE_PX * 4 + BORDER_PX * 2);
  });

  it("비제어로 타이핑해도 다시 잰다", () => {
    const { getByRole } = render(<Textarea />);
    const el = getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(el, { target: { value: "a\nb" } });
    expect(heightOf(el)).toBe(LINE_PX * 2 + BORDER_PX * 2);
  });
});

describe("Textarea 인스턴스별 접근성 연결", () => {
  it("동일 라벨 클릭은 각각의 입력과 설명을 가리킨다", async () => {
    const user = userEvent.setup();
    const { container, getAllByRole } = render(<>
      <Textarea label="내용" hint="첫 번째 설명" />
      <Textarea label="내용" hint="두 번째 설명" />
    </>);
    const fields = getAllByRole("textbox");
    expect(fields[0].id).not.toBe(fields[1].id);
    for (const [index, label] of Array.from(container.querySelectorAll("label")).entries()) {
      await user.click(label);
      expect(fields[index]).toHaveFocus();
      expect(fields[index]).toHaveAccessibleName("내용");
      expect(fields[index]).toHaveAccessibleDescription(index === 0 ? "첫 번째 설명" : "두 번째 설명");
    }
    const ids = Array.from(container.querySelectorAll("[id]")).map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("동일 라벨 오류는 각 인스턴스의 오류를 설명한다", () => {
    const { getAllByRole } = render(<>
      <Textarea label="내용" hint="첫 힌트" error="첫 오류" hintPosition="top" required />
      <Textarea label="내용" hint="둘째 힌트" error="둘째 오류" />
    </>);
    const fields = getAllByRole("textbox");
    expect(fields[0]).toHaveAccessibleDescription("첫 오류");
    expect(fields[1]).toHaveAccessibleDescription("둘째 오류");
    expect(fields[0]).toBeRequired();
    expect(fields[0]).toHaveAttribute("aria-invalid", "true");
  });

  it("라벨 변경과 오류 전환 뒤에도 입력 ID가 유지된다", () => {
    const { getByRole, rerender } = render(<Textarea label="처음" hint="설명" />);
    const field = getByRole("textbox");
    const id = field.id;
    rerender(<Textarea label="변경" hint="설명" error="오류" />);
    expect(field.id).toBe(id);
    expect(field).toHaveAccessibleName("변경");
    expect(field).toHaveAccessibleDescription("오류");
    rerender(<Textarea label="변경" hint="설명" />);
    expect(field.id).toBe(id);
    expect(field).toHaveAccessibleDescription("설명");
  });

  it("라벨이 없어도 힌트와 오류에 고유 연결을 부여한다", () => {
    const { getAllByRole } = render(<>
      <Textarea aria-label="힌트 입력" hint="힌트 설명" />
      <Textarea aria-label="오류 입력" error="오류 설명" />
    </>);
    const fields = getAllByRole("textbox");
    expect(fields[0].id).toBeTruthy();
    expect(fields[0].id).not.toBe(fields[1].id);
    expect(fields[0]).toHaveAccessibleDescription("힌트 설명");
    expect(fields[1]).toHaveAccessibleDescription("오류 설명");
  });

  it("명시 ID와 소비자 aria-describedby 우선 계약을 보존한다", () => {
    const { getByRole, rerender } = render(<>
      <p id="external-help">외부 설명</p>
      <Textarea id="custom-id" label="내용" hint="내부 설명" aria-describedby="external-help" />
    </>);
    const field = getByRole("textbox");
    expect(field.id).toBe("custom-id");
    expect(field).toHaveAccessibleName("내용");
    expect(field).toHaveAttribute("aria-describedby", "external-help");
    expect(field).toHaveAccessibleDescription("외부 설명");
    rerender(<>
      <p id="external-help">외부 설명</p>
      <Textarea id="custom-id" label="내용" hint="내부 설명" />
    </>);
    expect(field).toHaveAttribute("aria-describedby", "custom-id-hint");
    expect(field).toHaveAccessibleDescription("내부 설명");
  });

  it("SSR ID와 설명 연결이 hydration 후 유지된다", async () => {
    const content = <>
      <Textarea label="내용" hint="서버 힌트" />
      <Textarea label="내용" error="서버 오류" />
      <Textarea id="server-explicit" label="명시" hint="명시 설명" />
    </>;
    const container = document.createElement("div");
    container.innerHTML = renderToString(content);
    document.body.appendChild(container);
    const before = Array.from(container.querySelectorAll("textarea")).map(node => ({
      id: node.id, describedBy: node.getAttribute("aria-describedby"),
    }));
    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, content, { onRecoverableError: recoverable });
      });
      const fields = Array.from(container.querySelectorAll("textarea"));
      expect(fields.map(node => ({ id: node.id, describedBy: node.getAttribute("aria-describedby") }))).toEqual(before);
      expect(new Set(fields.map(node => node.id)).size).toBe(3);
      expect(fields[0]).toHaveAccessibleDescription("서버 힌트");
      expect(fields[1]).toHaveAccessibleDescription("서버 오류");
      expect(fields[2].id).toBe("server-explicit");
      expect(recoverable).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      if (root) await act(async () => root?.unmount());
      container.remove();
      consoleError.mockRestore();
    }
  });

  it("forwarded ref와 비제어 입력 핸들러를 보존한다", () => {
    const ref = createRef<HTMLTextAreaElement>();
    const onChange = vi.fn();
    const { getByRole } = render(<Textarea ref={ref} label="내용" defaultValue="초기" onChange={onChange} />);
    const field = getByRole("textbox");
    expect(ref.current).toBe(field);
    fireEvent.change(field, { target: { value: "변경\n추가" } });
    expect(field).toHaveValue("변경\n추가");
    expect(onChange).toHaveBeenCalledOnce();
    expect(heightOf(field as HTMLTextAreaElement)).toBe(LINE_PX * 2 + BORDER_PX * 2);
  });
});
