import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// FRT-107 — 온보딩 스텝 계측은 "온보딩을 하고 있는 사람"만 세야 한다.
//
// page.test.tsx 와 나누는 이유는 mock 의 성질이 다르기 때문이다. 저쪽은 verify 화면에
// 머물러야 해서 인증 상태를 **고정**하는데, 여기서 봐야 하는 건 인증·온보딩 상태가
// 갈릴 때 계측이 어떻게 갈리는지라 그 축이 움직여야 한다.

const { SEARCH_PARAMS } = vi.hoisted(() => ({
  // 온보딩 스텝을 URL 로 직접 여는 진입(stale 링크·뒤로가기·수동 입력)이 이 파일의 무대다.
  SEARCH_PARAMS: new URLSearchParams("step=profile"),
}));

const { authState } = vi.hoisted(() => ({
  authState: {
    user: null as unknown,
    isAuthenticated: false,
    isOnboarded: false,
    isLoading: false,
    error: null as unknown,
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => SEARCH_PARAMS,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

// capture 만 가짜다 — useFlowExit/useExitSignal 은 진짜여야 "언제 발화하는가"를 볼 수 있다.
vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn(), markSignupCompletedIfUnseen: vi.fn() };
});

vi.mock("framer-motion", () => {
  const MOTION_ONLY_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "custom",
    "variants",
  ]);
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

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { capture } from "@/lib/analytics";
import { FIRST_ONBOARDING_STEP } from "../constants";

import SignupPage from "./page";

const captureMock = vi.mocked(capture);

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  authState.isAuthenticated = false;
  authState.isOnboarded = false;
  authState.isLoading = false;
});

// 언마운트 발화는 StrictMode 이중 마운트를 걸러내려고 한 틱 미룬다 — 그 틱을 흘려보낸다.
function settle(): void {
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

function eventNames(): string[] {
  return captureMock.mock.calls.map(([name]) => name);
}

function payloadOf(event: string): Record<string, unknown> | undefined {
  const call = captureMock.mock.calls.find(([name]) => name === event);
  return call?.[1] as Record<string, unknown> | undefined;
}

describe("온보딩 스텝 계측 — 누구를 세는가(FRT-107)", () => {
  it("온보딩을 이미 마친 사용자가 스텝 URL 에 닿아도 조회·이탈을 세지 않는다", () => {
    // stale 링크·뒤로가기로 /signup?step=profile 에 닿은 완료 사용자. 리다이렉트가 화면을
    // 걷어낼 때까지 스텝이 잠깐 살아 있는데, 그 찰나를 세면 퍼널이 통째로 부푼다.
    authState.isAuthenticated = true;
    authState.isOnboarded = true;

    const { unmount } = render(<SignupPage />);
    expect(eventNames()).not.toContain("onboarding_step_viewed");

    unmount();
    settle();

    expect(eventNames()).not.toContain("onboarding_abandoned");
  });

  it("인증 판정이 끝나기 전에는 흐름을 시작하지 않는다", () => {
    // 판정 전에 시작해 두면, 판정이 "자격 없음"으로 끝나는 순간 그 비활성화가 그대로
    // 이탈로 발화한다 — 떠난 게 아니라 애초에 들어오지 못한 사람인데도.
    authState.isAuthenticated = true;
    authState.isOnboarded = true;
    authState.isLoading = true;

    const { unmount } = render(<SignupPage />);
    unmount();
    settle();

    expect(eventNames()).not.toContain("onboarding_step_viewed");
    expect(eventNames()).not.toContain("onboarding_abandoned");
  });

  it("온보딩 중인 사용자는 스텝 진입이 그대로 잡힌다", () => {
    render(<SignupPage />);

    expect(captureMock).toHaveBeenCalledWith("onboarding_step_viewed", {
      step: FIRST_ONBOARDING_STEP,
      step_index: 0,
    });
  });

  // 중복 방지 값과 last_step 스냅샷을 한 ref 로 합치면 여기서 걸린다. 되돌아온 새 세션의
  // 첫 스텝이 직전 세션의 마지막 스텝과 같다는 이유로 조회가 삼켜져, 이탈만 있고 그에
  // 대응하는 스텝 조회가 없는 데이터가 된다.
  it("흐름을 나갔다 되돌아오면 같은 스텝이어도 새 세션의 조회를 다시 잡는다", () => {
    const view = render(<SignupPage />);
    expect(eventNames().filter((n) => n === "onboarding_step_viewed")).toHaveLength(1);

    // 온보딩 밖(verify)으로 나갔다가 —
    fireEvent.click(screen.getByRole("button", { name: "← 이전" }));
    settle();

    // 인증이 끝나 첫 온보딩 스텝으로 다시 들어온다(page.tsx 의 verify 강제 이탈 effect).
    authState.isAuthenticated = true;
    act(() => {
      view.rerender(<SignupPage />);
    });

    expect(eventNames().filter((n) => n === "onboarding_step_viewed")).toHaveLength(2);
  });

  it("흐름 밖으로 되돌아가 그만두면 last_step 은 이탈 후가 아니라 머물렀던 스텝이다", () => {
    render(<SignupPage />);

    act(() => {
      vi.advanceTimersByTime(7_000);
    });

    // 「← 이전」 → 온보딩 밖(verify)으로 나간다. 언마운트가 없는 이탈이라, 발화가 한 틱
    // 미뤄지는 사이 렌더가 콜백을 **이탈 후 step** 을 쥔 것으로 갈아끼운다.
    fireEvent.click(screen.getByRole("button", { name: "← 이전" }));
    settle();

    expect(eventNames()).toContain("onboarding_abandoned");
    expect(payloadOf("onboarding_abandoned")).toEqual({
      last_step: FIRST_ONBOARDING_STEP,
      elapsed_seconds: 7,
    });
  });
});
