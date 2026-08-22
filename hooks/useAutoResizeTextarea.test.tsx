import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";
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

/**
 * 훅이 등록한 콜백을 테스트가 직접 당길 수 있도록 잡아 두는 가짜 옵저버.
 *
 * 실제 `ResizeObserver` 는 `observe()` 하면 **지금 크기로 콜백을 한 번 준다**. 훅이 바로 그 첫 통지로
 * 기준 너비를 잡으므로 가짜도 똑같이 준다 — 안 그러면 "기준을 언제 잡는가"가 테스트에서 통째로 빠진다.
 */
class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: ResizeObserverCallback;
  private target: HTMLTextAreaElement | null = null;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.target = target as HTMLTextAreaElement;
    this.fire();
  }

  unobserve() {}
  disconnect() {}

  /**
   * 브라우저가 크기 변화를 통지하는 순간을 흉내낸다.
   * `width` 를 주면 그 너비로, 없으면 지금 요소의 너비로 통지한다.
   */
  fire(width?: number) {
    const el = this.target;
    if (!el) throw new Error("observe() 하기 전에는 통지할 수 없다");
    const entry = { contentRect: { width: width ?? widthOf(el) } };
    this.callback([entry] as unknown as ResizeObserverEntry[], this);
  }
}

globalThis.ResizeObserver = FakeResizeObserver;

/**
 * jsdom 에는 `document.fonts` 가 **아예 없다**(속성 자체가 undefined). 늦게 도착한 웹폰트가 글꼴을
 * 밀어내는 순간을 재현하려면 최소한의 가짜를 심어야 한다. `ready` 는 테스트가 직접 풀 수 있게
 * 보류 상태로 시작한다 — 그래야 "풀리기 전"과 "풀린 뒤"를 갈라 볼 수 있다.
 */
class FakeFontFaceSet extends EventTarget {
  readonly ready: Promise<void>;
  private settle!: () => void;

  constructor() {
    super();
    this.ready = new Promise<void>(resolve => {
      this.settle = resolve;
    });
  }

  /** 최초 폰트 로딩이 끝나는 순간. */
  settleReady() {
    this.settle();
  }

  /** 서브셋 조각이 하나 더 도착해 글꼴이 교체되는 순간. */
  finishLoading() {
    this.dispatchEvent(new Event("loadingdone"));
  }
}

let fakeFonts = new FakeFontFaceSet();
Object.defineProperty(document, "fonts", {
  configurable: true,
  get: () => fakeFonts,
});

beforeEach(() => {
  // `ready` 는 한 번 풀리면 되돌릴 수 없다 — 테스트마다 새로 심는다.
  fakeFonts = new FakeFontFaceSet();
});

afterEach(cleanup);
afterEach(() => {
  FakeResizeObserver.instances = [];
});

/** 대기 중인 마이크로태스크(`fonts.ready.then`)를 흘려보낸다. */
function flush() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

/**
 * jsdom 은 `scrollHeight`·`clientWidth` 접근자를 `Element.prototype` 에 둔다 — `HTMLTextAreaElement`
 * 에는 원래 자기 소유 프로퍼티가 없으므로 "원본 descriptor 를 되돌린다"가 성립하지 않는다.
 * 우리가 덮어쓴 것을 **지워야** 상속이 되살아난다.
 */
function restoreOwnProp(obj: object, prop: string, original: PropertyDescriptor | undefined) {
  if (original) {
    Object.defineProperty(obj, prop, original);
    return;
  }
  Reflect.deleteProperty(obj, prop);
}

// 되돌리는 것은 파일이 끝날 때 한 번이다. `afterEach` 로 하면 첫 테스트가 끝나는 순간 스텁이 사라져
// 나머지 테스트가 맨 jsdom(=scrollHeight 0, ResizeObserver 없음) 위에서 돌게 된다.
// 그래도 파일 밖으로는 새지 않아야 한다 — 같은 워커의 다른 테스트 파일이 이 스텁을 물려받으면 안 된다.
afterAll(() => {
  restoreOwnProp(HTMLTextAreaElement.prototype, "scrollHeight", originalScrollHeight);
  restoreOwnProp(HTMLTextAreaElement.prototype, "clientWidth", originalClientWidth);
  restoreOwnProp(document, "fonts", undefined);
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

/** 훅이 다시 쟀는지를 눈에 보이게 하려고 일부러 엉뚱한 값을 박아 둔다. */
const SENTINEL_HEIGHT = "999px";

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

    el.style.height = SENTINEL_HEIGHT;
    FakeResizeObserver.instances[0].fire();

    expect(el.style.height).toBe(SENTINEL_HEIGHT);
  });

  it("정수로 반올림하면 같아지는 소수점 너비 변화도 잡는다 — clientWidth 로 보면 놓친다", () => {
    // 반응형 그리드에서 칸 너비는 소수점으로 떨어진다. `clientWidth` 는 그걸 정수로 반올림하므로
    // 300.4 → 300.6 은 둘 다 300 으로 보인다. 하필 그 사이에 줄바꿈 경계가 있으면 줄이 하나 늘어나는데
    // 가드가 "그대로"라고 판단해 삼켜 버리고, 늘어난 줄은 `overflow-hidden` 에 잘린다.
    const { container } = render(<Probe value="한 줄" widthPx={1000} />);
    const el = textareaIn(container);
    const observer = FakeResizeObserver.instances[0];

    observer.fire(300.4);
    el.style.height = SENTINEL_HEIGHT;
    observer.fire(300.6);

    expect(el.style.height).not.toBe(SENTINEL_HEIGHT);
  });

  it("늦게 도착한 웹폰트가 글꼴을 바꾸면 다시 잰다 — 값도 너비도 그대로인데 줄 수만 달라진다", () => {
    // 이 앱은 Pretendard 를 CDN 에서 받는다(app/layout.tsx). Apple SD Gothic Neo 가 없는 환경에서는
    // 대체 글꼴로 먼저 그린 뒤 폰트가 도착하면 글리프 폭이 바뀐다 — `value` 도 너비도 그대로라
    // 앞의 두 트리거 중 어느 것도 걸리지 않는다.
    const { container } = render(<Probe value="한 줄" widthPx={1000} />);
    const el = textareaIn(container);
    el.style.height = SENTINEL_HEIGHT;

    fakeFonts.finishLoading();

    expect(el.style.height).not.toBe(SENTINEL_HEIGHT);
  });

  it("구독보다 폰트 로딩이 먼저 끝났어도 놓치지 않는다 — ready 가 그 창을 닫는다", async () => {
    // 'loadingdone' 은 지나간 일을 알려주지 않는다. 마운트가 폰트 도착보다 늦으면 이벤트는 영영 안 온다.
    const { container } = render(<Probe value="한 줄" widthPx={1000} />);
    const el = textareaIn(container);
    el.style.height = SENTINEL_HEIGHT;

    fakeFonts.settleReady();
    await flush();

    expect(el.style.height).not.toBe(SENTINEL_HEIGHT);
  });

  it("언마운트한 뒤 폰트가 도착하면 아무것도 건드리지 않는다", async () => {
    const { container, unmount } = render(<Probe value="한 줄" widthPx={1000} />);
    const el = textareaIn(container);

    unmount();
    el.style.height = SENTINEL_HEIGHT;
    fakeFonts.finishLoading();
    fakeFonts.settleReady();
    await flush();

    expect(el.style.height).toBe(SENTINEL_HEIGHT);
  });
});
