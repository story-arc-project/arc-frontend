import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

/**
 * FRT-126 — 생성 오버레이의 메시지 index 초기화.
 *
 * 오버레이는 부모(CreateResumeModal · cover-letter/new)에 **조건 없이 상주**한 채 `open` 만
 * 토글된다. 생성이 실패하면 open=false 로 닫혔다가 '다시 시도'로 다시 열리는데, index 가
 * 그대로 살아 있어 첫 메시지가 아니라 **직전에 멈춘 메시지**부터 이어졌다.
 *
 * 애니메이션이 아니라 index 상태를 검증하는 테스트라 framer-motion 은 통과시킨다 —
 * AnimatePresence 의 mode="wait" 는 exit 이 끝날 때까지 다음 노드를 마운트하지 않아
 * (rAF 기반) 메시지 전환 관찰이 타이머에 얽히기 때문이다.
 */
vi.mock("framer-motion", () => {
  // 모션 전용 prop 이 DOM 으로 새면 React 가 경고한다 — 렌더 전에 걸러낸다.
  const MOTION_ONLY_PROPS = new Set(["initial", "animate", "exit", "transition"]);
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        function MotionMock({
          children,
          ...props
        }: { children?: ReactNode } & Record<string, unknown>) {
          const domProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !MOTION_ONLY_PROPS.has(key)),
          );
          return createElement(tag, domProps, children);
        },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
  };
});

import { ResumeGenerationOverlay } from "./ResumeGenerationOverlay";
import { CoverLetterGenerationOverlay } from "./CoverLetterGenerationOverlay";

const ROTATE_MS = 4000;

const RESUME_MESSAGES = [
  "경험을 읽고 있어요…",
  "섹션을 구성하고 있어요…",
  "내용을 정리하고 있어요…",
  "마지막 점검 중이에요…",
];

const COVER_LETTER_MESSAGES = [
  "회사를 알아보고 있어요…",
  "문항별로 초안을 쓰고 있어요…",
  "기록에 근거한 내용인지 확인하고 있어요…",
  "문장을 다듬고 있어요…",
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe.each([
  {
    name: "ResumeGenerationOverlay",
    Overlay: ResumeGenerationOverlay,
    messages: RESUME_MESSAGES,
  },
  {
    name: "CoverLetterGenerationOverlay",
    Overlay: CoverLetterGenerationOverlay,
    messages: COVER_LETTER_MESSAGES,
  },
])("$name", ({ Overlay, messages }) => {
  it("열려 있는 동안 메시지가 순서대로 넘어간다", () => {
    // 대조군 — 이 단언이 없으면 "index 를 0 에 고정"하는 회귀도 아래 테스트를 통과한다.
    render(<Overlay open />);
    expect(screen.getByText(messages[0])).toBeTruthy();

    advance(ROTATE_MS);
    expect(screen.getByText(messages[1])).toBeTruthy();

    advance(ROTATE_MS);
    expect(screen.getByText(messages[2])).toBeTruthy();
  });

  it("실패 후 다시 열면 첫 메시지부터 시작한다", () => {
    const { rerender } = render(<Overlay open />);

    // 생성이 진행되며 마지막 메시지까지 갔다.
    advance(ROTATE_MS * 3);
    expect(screen.getByText(messages[3])).toBeTruthy();

    // 실패 → 오버레이가 닫히고, 사용자가 '다시 시도'를 눌러 같은 인스턴스가 다시 열린다.
    rerender(<Overlay open={false} />);
    rerender(<Overlay open />);

    expect(screen.getByText(messages[0])).toBeTruthy();
    expect(screen.queryByText(messages[3])).toBeNull();
  });

  it("다시 연 뒤에도 회전 주기는 처음부터 다시 센다", () => {
    const { rerender } = render(<Overlay open />);
    advance(ROTATE_MS * 3);
    rerender(<Overlay open={false} />);
    rerender(<Overlay open />);

    advance(ROTATE_MS);
    expect(screen.getByText(messages[1])).toBeTruthy();
  });

  it("닫혀 있는 동안에는 메시지가 돌지 않는다", () => {
    const { rerender } = render(<Overlay open={false} />);
    advance(ROTATE_MS * 5);
    rerender(<Overlay open />);

    expect(screen.getByText(messages[0])).toBeTruthy();
  });
});
