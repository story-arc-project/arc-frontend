import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// FRT-282: 가입·인증 실패 메시지는 버튼에 포커스가 머문 채 비동기로 나타난다.
// 역할을 주지 않으면 스크린리더 사용자에게는 아무 일도 일어나지 않은 것과 같다
// — 같은 화면의 재발송 결과(FRT-218)는 이미 role="alert" 로 그 처리를 받고 있었는데,
// 훨씬 자주 발생하는 가입·인증 실패에는 빠져 있었다.
// 여기서 보는 건 문구가 아니라 "실패가 프로그램적으로 알려지는가" 다.

// useSearchParams 는 내비게이션 단위로 같은 인스턴스를 돌려준다(page.test.tsx 와 같은 이유).
// 매 렌더 새 객체를 주면 step 복원 이펙트가 렌더마다 재실행된다.
const { SEARCH_PARAMS } = vi.hoisted(() => ({
  SEARCH_PARAMS: new URLSearchParams("step=start"),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => SEARCH_PARAMS,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// verify 단계는 인증 사용자를 온보딩으로 강제 이탈시킨다. 미인증으로 고정해야 화면에 머문다.
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
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ApiError 는 실제 클래스를 그대로 둔다 — instanceof 분기가 진짜로 갈리는지 봐야 한다.
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, api: { ...actual.api, post: vi.fn() } };
});

import { api } from "@/lib/api/client";
import { ConsentStep } from "@/components/features/auth/ConsentStep";

import SignupPage from "./page";

const post = vi.mocked(api.post);

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);
afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const NETWORK_MESSAGE = "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.";

/** step 파라미터는 마운트 직후 이펙트로 반영되므로 한 번 흘려보내야 해당 UI 가 뜬다. */
async function renderStep(step: "start" | "password" | "verify") {
  SEARCH_PARAMS.set("step", step);
  render(<SignupPage />);
  await act(async () => {});
}

async function clickButton(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function typeInto(label: string, value: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
}

/**
 * 실패 문구가 "즉시 읽어주는" 라이브 영역으로 노출되는지 — 문구가 아니라 그 자리의 역할을 본다.
 *
 * 역할만 보면 부족하다. `role="alert"` 의 암묵 `aria-live` 는 assertive 인데 polite 를 **명시**하면
 * 그 값이 이겨서 낭독이 다른 발화 뒤로 밀린다 — 역할은 그대로라 role 검사만으로는 안 잡힌다.
 */
function assertAnnounced(message: string) {
  const alert = screen
    .getAllByRole("alert")
    .find((el) => el.textContent?.includes(message));
  expect(alert).toBeDefined();
  expect(alert?.getAttribute("aria-live")).not.toBe("polite");
}

/** 지금 화면에 낭독될 실패 문구가 하나도 없다 — 리마운트로 지난 실패가 되살아나지 않았는지 본다. */
function assertNothingAnnounced() {
  expect(screen.queryAllByRole("alert")).toHaveLength(0);
}

describe("회원가입 — 실패를 보조기술에 알린다", () => {
  it("가입에 실패하면 실패 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderStep("password");

    await typeInto("비밀번호", "arcpass123");
    await typeInto("비밀번호 확인", "arcpass123");
    await clickButton("가입하기");

    assertAnnounced(NETWORK_MESSAGE);
  });

  it("인증 코드 확인에 실패하면 실패 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderStep("verify");

    await typeInto("인증 코드", "123456");
    await clickButton("확인");

    assertAnnounced(NETWORK_MESSAGE);
  });

  // 소셜 로그인 실패도 버튼에 포커스가 머문 채 문구만 나타난다 — 같은 무반응이다.
  it("Google 로그인을 쓸 수 없으면 그 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    // 이 분기는 클라이언트 ID 가 **없을 때**만 탄다. 환경에 값이 있으면(개발자 로컬·CI)
    // OAuth 리다이렉트로 빠져 문구가 아예 뜨지 않는다 — 환경에 기대지 않도록 못 박는다.
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    await renderStep("start");

    await clickButton(/Google/);

    assertAnnounced("Google 로그인을 사용할 수 없어요");
  });

  // 실패 문구를 남겨둔 채 스텝을 벗어났다 돌아오면 요소가 리마운트되고, role="alert" 는
  // 마운트되는 순간을 "새 알림"으로 읽는다 — 아직 아무것도 다시 시도하지 않았는데
  // 지난 실패가 다시 낭독되는 건 알려주는 게 아니라 속이는 것이다.
  it("실패한 뒤 되돌아갔다 다시 들어오면 지난 실패를 다시 읽지 않는다", async () => {
    post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderStep("password");

    await typeInto("비밀번호", "arcpass123");
    await typeInto("비밀번호 확인", "arcpass123");
    await clickButton("가입하기");
    assertAnnounced(NETWORK_MESSAGE);

    await clickButton("← 이전"); // password → start
    await typeInto("이메일", "test@example.com"); // 「이메일로 계속하기」는 값이 있어야 열린다
    await clickButton("이메일로 계속하기"); // start → password (리마운트)

    assertNothingAnnounced();
  });

  // 동의 제출 실패도 같은 결함이다(CONSENT_ENABLED off 라 화면에는 아직 안 걸려 있다).
  it("동의 제출에 실패하면 실패 사실이 즉시 읽히는 영역으로 노출된다", () => {
    render(<ConsentStep onSubmit={vi.fn()} error={NETWORK_MESSAGE} />);

    assertAnnounced(NETWORK_MESSAGE);
  });
});
