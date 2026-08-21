import { describe, it, expect, afterAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { useAutoResizeTextarea } from "./useAutoResizeTextarea";

// jsdom 은 레이아웃을 계산하지 않아 `scrollHeight` 가 언제나 0이고 `clientWidth` 도 언제나 0이다 —
// 스텁 없이는 "내용만큼 늘어난다"를 단언할 방법이 없다. 그래서 실제 브라우저의 계약만 최소로 흉내낸다:
//   scrollHeight = max(내용 높이, 명시적으로 지정된 height)
//   내용 높이   = 줄 수 × 줄높이 + 패딩,  줄 수는 **칸 너비에 따라 접힌 뒤의** 줄 수
// 두 가지가 핵심이다. (1) `max` 의 두 번째 항 — 훅이 `height="auto"` 로 먼저 리셋하지 않으면 한 번
// 커진 칸은 영영 안 줄어든다. (2) 줄 수가 너비에 걸린다는 것 — 값이 그대로여도 칸이 좁아지면
// 높이가 달라져야 한다는 사실을 이 모델이 있어야 표현할 수 있다.
const LINE_PX = 20;
const PADDING_PX = 16;
const CHAR_PX = 10;
const DEFAULT_WIDTH_PX = 1000;

/** 테스트가 칸 너비를 조종하는 통로. `data-test-width` 가 없으면 넉넉한 기본 너비. */
function widthOf(el: HTMLTextAreaElement) {
  const raw = el.dataset.testWidth;
  return raw === undefined ? DEFAULT_WIDTH_PX : Number(raw);
}

function contentHeight(el: HTMLTextAreaElement) {
  const charsPerLine = Math.max(1, Math.floor(widthOf(el) / CHAR_PX));
  const lines = el.value
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return PADDING_PX + LINE_PX * lines;
}

const originalScrollHeight = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  "scrollHeight"
);
const originalClientWidth = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  "clientWidth"
);
const originalResizeObserver = globalThis.ResizeObserver;

Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
  configurable: true,
  get(this: HTMLTextAreaElement) {
    const explicit = this.style.height;
    if (!explicit || explicit === "auto") return contentHeight(this);
    return Math.max(contentHeight(this), parseFloat(explicit) || 0);
  },
});

Object.defineProperty(HTMLTextAreaElement.prototype, "clientWidth", {
  configurable: true,
  get(this: HTMLTextAreaElement) {
    return widthOf(this);
  },
});

/** 훅이 등록한 콜백을 테스트가 직접 당길 수 있도록 잡아 두는 가짜 옵저버. */
class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  /** 브라우저가 크기 변화를 통지하는 순간을 흉내낸다. */
  fire() {
    this.callback([], this);
  }
}

globalThis.ResizeObserver = FakeResizeObserver;

afterEach(cleanup);
afterEach(() => {
  FakeResizeObserver.instances = [];
});

/**
 * jsdom 은 `scrollHeight`·`clientWidth` 접근자를 `Element.prototype` 에 둔다 — `HTMLTextAreaElement`
 * 에는 원래 자기 소유 프로퍼티가 없으므로 "원본 descriptor 를 되돌린다"가 성립하지 않는다.
 * 우리가 덮어쓴 것을 **지워야** 상속이 되살아난다.
 */
function restoreTextareaProp(prop: string, original: PropertyDescriptor | undefined) {
  if (original) {
    Object.defineProperty(HTMLTextAreaElement.prototype, prop, original);
    return;
  }
  Reflect.deleteProperty(HTMLTextAreaElement.prototype, prop);
}

// 되돌리는 것은 파일이 끝날 때 한 번이다. `afterEach` 로 하면 첫 테스트가 끝나는 순간 스텁이 사라져
// 나머지 테스트가 맨 jsdom(=scrollHeight 0, ResizeObserver 없음) 위에서 돌게 된다.
// 그래도 파일 밖으로는 새지 않아야 한다 — 같은 워커의 다른 테스트 파일이 이 스텁을 물려받으면 안 된다.
afterAll(() => {
  restoreTextareaProp("scrollHeight", originalScrollHeight);
  restoreTextareaProp("clientWidth", originalClientWidth);
  if (originalResizeObserver) {
    globalThis.ResizeObserver = originalResizeObserver;
  } else {
    Reflect.deleteProperty(globalThis, "ResizeObserver");
  }
});

function Probe({
  value,
  borderPx = 0,
  widthPx,
}: {
  value: string;
  borderPx?: number;
  widthPx?: number;
}) {
  const ref = useAutoResizeTextarea(value);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={() => {}}
      aria-label="probe"
      data-test-width={widthPx}
      style={{ borderTopWidth: `${borderPx}px`, borderBottomWidth: `${borderPx}px` }}
    />
  );
}

function textareaIn(container: HTMLElement) {
  const el = container.querySelector("textarea");
  if (!el) throw new Error("textarea 가 렌더되지 않았다");
  return el;
}

function heightOf(container: HTMLElement) {
  return parseFloat(textareaIn(container).style.height);
}

describe("useAutoResizeTextarea", () => {
  it("마운트 직후부터 내용 높이에 맞춰져 있다 — 저장된 긴 값을 불러오는 경로", () => {
    const { container } = render(<Probe value={"한 줄\n두 줄\n세 줄"} />);
    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX * 3);
  });

  it("내용이 길어지면 칸이 자란다", () => {
    const { container, rerender } = render(<Probe value="한 줄" />);
    const before = heightOf(container);

    rerender(<Probe value={"한 줄\n두 줄\n세 줄\n네 줄"} />);

    expect(heightOf(container)).toBeGreaterThan(before);
    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX * 4);
  });

  it("내용이 짧아지면 칸이 다시 줄어든다 — height 를 auto 로 리셋한다는 증거", () => {
    const { container, rerender } = render(<Probe value={"한 줄\n두 줄\n세 줄\n네 줄"} />);

    rerender(<Probe value="한 줄" />);

    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX);
  });

  it("테두리 두께를 더해 준다 — box-sizing:border-box 에서 마지막 줄이 잘리지 않도록", () => {
    // `style.height` 는 테두리를 포함(border-box)하지만 `scrollHeight` 는 테두리를 뺀 값이다.
    // 보정하지 않으면 위아래 테두리 합만큼 칸이 모자라 `overflow-hidden` 이 마지막 줄을 갉아먹는다.
    const { container } = render(<Probe value={"한 줄\n두 줄"} borderPx={1} />);

    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX * 2 + 2);
  });

  it("값이 그대로여도 칸이 좁아져 줄이 늘면 다시 잰다 — 창 크기 변경·반응형 리플로우", () => {
    // 40자 한 줄. 넓을 땐 한 줄이지만 400px(=40자) 밑으로 좁아지면 접힌다.
    const value = "가".repeat(40);
    const { container } = render(<Probe value={value} widthPx={1000} />);
    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX);

    // 브라우저가 칸을 100px 로 줄인 상황 — 40자가 10자씩 네 줄로 접힌다.
    textareaIn(container).dataset.testWidth = "100";
    FakeResizeObserver.instances[0].fire();

    // 다시 재지 않으면 높이는 한 줄짜리에 머물고, `overflow-hidden` 탓에 나머지 세 줄이 조용히 잘린다.
    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX * 4);
  });

  it("너비가 그대로면 다시 재지 않는다 — 자기 높이 변화가 되먹임 루프를 만들지 않도록", () => {
    // 옵저버는 자기 자신을 보므로 훅이 준 '높이' 변경도 콜백을 다시 부른다.
    // 그때마다 다시 재면 통지→측정→통지 가 끝나지 않는다.
    const { container } = render(<Probe value="한 줄" widthPx={1000} />);
    const el = textareaIn(container);

    // 훅이 다시 쟀는지 여부를 눈에 보이게 하려고 일부러 엉뚱한 값을 박아 둔다.
    el.style.height = "999px";
    FakeResizeObserver.instances[0].fire();

    expect(el.style.height).toBe("999px");
  });
});
