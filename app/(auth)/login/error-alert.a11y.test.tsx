import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// FRT-340: 로그인 실패 문구는 「로그인」 버튼에 포커스가 머문 채 비동기로 나타난다.
// 역할을 주지 않으면 스크린리더 사용자에게는 아무 일도 일어나지 않은 것과 같다
// — 회원가입 흐름은 FRT-282 에서 같은 처방을 이미 받았고, 로그인은 그 범위 밖이라 남아 있었다.
// 여기서 보는 건 문구가 아니라 "실패가 프로그램적으로 알려지는가" 다.

const { SEARCH_PARAMS } = vi.hoisted(() => ({
  SEARCH_PARAMS: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => SEARCH_PARAMS,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// 인증 사용자는 로그인 화면에서 튕겨나간다(useRedirectIfAuthenticated). 미인증으로 고정해야 화면에 머문다.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isOnboarded: false,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("framer-motion", () => {
  const MOTION_ONLY_PROPS = new Set(["initial", "animate", "exit", "transition", "custom", "variants", "layout"]);
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

import LoginPage from "./page";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  SEARCH_PARAMS.forEach((_value, key) => SEARCH_PARAMS.delete(key));
});

/**
 * 실패 문구가 "즉시 읽어주는" 라이브 영역으로 노출되는지 — 문구가 아니라 그 자리의 역할을 본다.
 *
 * 역할만 보면 부족하다. `role="alert"` 의 암묵 `aria-live` 는 assertive 인데 polite 를 **명시**하면
 * 그 값이 이겨서 낭독이 다른 발화 뒤로 밀린다 — 역할은 그대로라 role 검사만으로는 안 잡힌다(FRT-282).
 */
function assertAnnounced(message: string) {
  const alert = screen
    .getAllByRole("alert")
    .find((el) => el.textContent?.includes(message));
  expect(alert).toBeDefined();
  expect(alert?.getAttribute("aria-live")).not.toBe("polite");
}

async function typeInto(label: string, value: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
}

async function clickButton(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function submitCredentials() {
  render(<LoginPage />);
  await act(async () => {});
  await typeInto("이메일", "test@example.com");
  await typeInto("비밀번호", "wrong-password");
  await clickButton("로그인");
}

describe("로그인 — 실패를 보조기술에 알린다", () => {
  it("비밀번호가 틀리면 실패 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ code: "INVALID_CREDENTIALS" }),
      }),
    );

    await submitCredentials();

    assertAnnounced("이메일 또는 비밀번호가 올바르지 않아요.");
  });

  // 서버가 답을 준 실패와 아예 닿지 못한 실패는 코드 경로가 갈리지만(응답 분기 vs catch),
  // 도착하는 자리는 같다. 한쪽만 역할을 받는 일이 없도록 두 경로를 모두 못 박는다.
  it("서버에 닿지 못해도 실패 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await submitCredentials();

    assertAnnounced("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
  });

  // 소셜 로그인 실패도 버튼에 포커스가 머문 채 문구만 나타난다 — 같은 무반응이다.
  it("Google 로그인을 쓸 수 없으면 그 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    // 이 분기는 클라이언트 ID 가 **없을 때**만 탄다. 환경에 값이 있으면(개발자 로컬·CI)
    // OAuth 리다이렉트로 빠져 문구가 아예 뜨지 않는다 — 환경에 기대지 않도록 못 박는다.
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    render(<LoginPage />);
    await act(async () => {});

    await clickButton(/Google/);

    assertAnnounced("Google 로그인을 사용할 수 없어요");
  });
});
