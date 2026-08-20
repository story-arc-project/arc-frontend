import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// FRT-296: 온보딩의 선택 버튼(현재 상태 · 고민 · 관심 분야)은 선택 여부를 색상으로만 알렸다.
// 버튼 이름은 선택 전후가 동일하고 aria-pressed 도 없어, 스크린리더로는 무엇이 골라졌는지
// 전혀 알 수 없었다. 여기서 보는 건 스타일이 아니라 "상태가 프로그램적으로 노출되는가" 다.

// useSearchParams 는 내비게이션 단위로 같은 인스턴스를 돌려준다(page.test.tsx 와 같은 이유).
// 매 렌더 새 객체를 주면 step 복원 이펙트가 렌더마다 재실행된다.
const { SEARCH_PARAMS } = vi.hoisted(() => ({
  SEARCH_PARAMS: new URLSearchParams("step=profile"),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => SEARCH_PARAMS,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// 온보딩 스텝에 머무르려면 미인증이어야 한다. useRedirectIfAuthenticated 도 이 훅을 읽는다.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isOnboarded: false,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn(), markSignupCompletedIfUnseen: vi.fn() };
});

vi.mock("framer-motion", () => {
  const MOTION_ONLY_PROPS = new Set(["initial", "animate", "exit", "transition", "custom", "variants"]);
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
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import SignupPage from "./page";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

/** step 파라미터는 마운트 직후 이펙트로 반영되므로 한 번 흘려보내야 해당 UI 가 뜬다. */
async function renderStep(step: "profile" | "q1" | "q2") {
  SEARCH_PARAMS.set("step", step);
  render(<SignupPage />);
  await act(async () => {});
}

async function clickOption(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function pressedOf(name: string) {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

describe("회원가입 온보딩 — 선택 상태를 보조기술에 노출한다", () => {
  describe("현재 상태(단일 선택)", () => {
    it("고르기 전에는 모든 선택지가 '선택되지 않음'으로 읽힌다", async () => {
      await renderStep("profile");

      expect(pressedOf("학생")).toBe("false");
      expect(pressedOf("직장인")).toBe("false");
      expect(pressedOf("취준생")).toBe("false");
      expect(pressedOf("기타")).toBe("false");
    });

    it("고른 항목만 '선택됨'으로 읽힌다", async () => {
      await renderStep("profile");

      await clickOption("직장인");

      expect(pressedOf("직장인")).toBe("true");
      expect(pressedOf("학생")).toBe("false");
    });

    // 이 버튼들은 다시 누르면 해제되는 토글이다(page.tsx 의 setAffiliation(active ? "" : ...)).
    // 해제가 aria-pressed 에 반영되지 않으면 스크린리더에는 계속 선택된 것으로 남는다.
    it("다시 누르면 '선택되지 않음'으로 돌아온다", async () => {
      await renderStep("profile");

      await clickOption("직장인");
      await clickOption("직장인");

      expect(pressedOf("직장인")).toBe("false");
    });

    // 버튼 각각의 상태만 노출되면 "무엇에 대한 선택인지"는 여전히 들리지 않는다.
    it("선택지 묶음이 '현재 상태'라는 이름으로 읽힌다", async () => {
      await renderStep("profile");

      expect(screen.getByRole("group", { name: /현재 상태/ })).toBeDefined();
    });
  });

  describe("Q1 고민(복수 선택)", () => {
    it("고르기 전에는 '선택되지 않음'으로 읽힌다", async () => {
      await renderStep("q1");

      expect(pressedOf("진로/방향성")).toBe("false");
    });

    it("복수로 고르면 고른 항목이 모두 '선택됨'으로 읽힌다", async () => {
      await renderStep("q1");

      await clickOption("진로/방향성");
      await clickOption("취업/인턴");

      expect(pressedOf("진로/방향성")).toBe("true");
      expect(pressedOf("취업/인턴")).toBe("true");
      expect(pressedOf("창업")).toBe("false");
    });

    it("다시 누르면 '선택되지 않음'으로 돌아온다", async () => {
      await renderStep("q1");

      await clickOption("진로/방향성");
      await clickOption("진로/방향성");

      expect(pressedOf("진로/방향성")).toBe("false");
    });

    it("선택지 묶음이 질문 이름으로 읽힌다", async () => {
      await renderStep("q1");

      expect(screen.getByRole("group", { name: /요즘 가장 고민되는 게 뭐예요/ })).toBeDefined();
    });
  });

  describe("Q2 관심 분야(복수 선택)", () => {
    it("고른 항목만 '선택됨'으로 읽힌다", async () => {
      await renderStep("q2");

      await clickOption("데이터/AI");

      expect(pressedOf("데이터/AI")).toBe("true");
      expect(pressedOf("디자인/UX")).toBe("false");
    });

    it("다시 누르면 '선택되지 않음'으로 돌아온다", async () => {
      await renderStep("q2");

      await clickOption("데이터/AI");
      await clickOption("데이터/AI");

      expect(pressedOf("데이터/AI")).toBe("false");
    });

    it("선택지 묶음이 질문 이름으로 읽힌다", async () => {
      await renderStep("q2");

      expect(screen.getByRole("group", { name: /관심 있는 분야를 골라보세요/ })).toBeDefined();
    });
  });
});
