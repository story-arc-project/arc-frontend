import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// FRT-218: verify 단계의 "코드 재발송"은 결과를 화면에 남겨야 한다.
// 예전에는 catch 가 `if (e instanceof ApiError)` 만 갖고 else 가 없어서,
// client.ts 의 fetch 가 그대로 던지는 네트워크 오류(raw TypeError)가 아무 분기에도
// 걸리지 않았다 — 버튼만 원상복귀되고 사용자는 재발송 성공 여부를 알 수 없었다.
// 성공 역시 안내가 없어 같은 무반응으로 보였다.

// Next 의 useSearchParams 는 내비게이션 단위로 같은 인스턴스를 돌려준다.
// 매 렌더 새 객체를 주면 page.tsx:111 의 [searchParams] 이펙트가 렌더마다 재실행돼
// step 이 계속 verify 로 되돌아간다 — 스텝을 벗어나는 흐름을 아예 테스트할 수 없다.
const { SEARCH_PARAMS } = vi.hoisted(() => ({
  SEARCH_PARAMS: new URLSearchParams("step=verify&email=test@example.com"),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => SEARCH_PARAMS,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// verify 단계는 인증 사용자를 온보딩으로 강제 이탈시킨다(page.tsx:113-117).
// 미인증으로 고정해야 이 화면에 머문다. useRedirectIfAuthenticated 도 이 훅을 읽는다.
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

// AnimatePresence 의 mode="wait" 는 exit 이 끝날 때까지 다음 스텝을 마운트하지 않는다(rAF 기반).
// 여기서 보는 건 애니메이션이 아니라 재발송 결과 문구라, GenerationOverlay.test.tsx 와 같은 방식으로 통과시킨다.
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

// ApiError 는 실제 클래스를 그대로 둔다 — instanceof 분기가 진짜로 갈리는지 봐야 한다.
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, api: { ...actual.api, post: vi.fn() } };
});

import { api, ApiError } from "@/lib/api/client";

import SignupPage from "./page";

const post = vi.mocked(api.post);

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const NETWORK_MESSAGE = "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
const SUCCESS_MESSAGE = "코드를 다시 보냈어요.";

// ?step=verify 는 useEffect 로 반영되므로, 마운트 직후 한 번 흘려보내야 verify UI 가 뜬다.
async function renderVerifyStep() {
  render(<SignupPage />);
  await act(async () => {});
}

async function clickButton(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function clickResend() {
  await clickButton("코드 재발송");
}

async function typeInto(label: string, value: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
}

// verify 에서 「← 이전」으로 start 까지 되돌아가 다른 이메일로 다시 가입한다.
// 컴포넌트는 언마운트되지 않으므로 이전 이메일의 상태가 그대로 따라온다.
async function restartSignupWith(nextEmail: string) {
  await clickButton("← 이전"); // verify → password
  await clickButton("← 이전"); // password → start
  await typeInto("이메일", nextEmail);
  await clickButton("이메일로 계속하기");
  await typeInto("비밀번호", "arcpass123");
  await typeInto("비밀번호 확인", "arcpass123");
  await clickButton("가입하기");
}

describe("회원가입 verify — 코드 재발송 결과 안내", () => {
  it("네트워크 오류(ApiError 가 아닌 예외)로 실패하면 안내 문구를 보여준다", async () => {
    // client.ts 의 request() 는 fetch reject 를 ApiError 로 감싸지 않고 그대로 던진다.
    post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderVerifyStep();

    await clickResend();

    expect(screen.getByText(NETWORK_MESSAGE)).toBeDefined();
  });

  it("재발송에 성공하면 다시 보냈다고 알려준다", async () => {
    post.mockResolvedValueOnce(undefined);
    await renderVerifyStep();

    await clickResend();

    expect(screen.getByText(SUCCESS_MESSAGE)).toBeDefined();
  });

  it("429 면 재발송 대기 안내를 그대로 보여준다", async () => {
    post.mockRejectedValueOnce(new ApiError(429, "too many requests"));
    await renderVerifyStep();

    await clickResend();

    expect(screen.getByText("5분 후 재발송 가능해요.")).toBeDefined();
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
  });

  // 거울상: 성공 문구는 실패 슬롯과 달리 handleResendCode 진입 시에만 지워진다.
  // 이 방향이 빠지면 setResendNotice(null) 을 지워도 아무 테스트가 빨개지지 않는다.
  it("성공 후 다시 눌러 실패하면 성공 문구가 남지 않는다", async () => {
    post
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderVerifyStep();

    await clickResend();
    expect(screen.getByText(SUCCESS_MESSAGE)).toBeDefined();

    await clickResend();

    expect(screen.getByText(NETWORK_MESSAGE)).toBeDefined();
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
  });

  it("실패 후 다시 눌러 성공하면 실패 문구가 남지 않는다", async () => {
    post
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(undefined);
    await renderVerifyStep();

    await clickResend();
    expect(screen.getByText(NETWORK_MESSAGE)).toBeDefined();

    await clickResend();

    expect(screen.getByText(SUCCESS_MESSAGE)).toBeDefined();
    expect(screen.queryByText(NETWORK_MESSAGE)).toBeNull();
  });

  // 재발송 결과는 그 이메일에 매인 진술이다. 다른 이메일로 다시 가입하면
  // 재발송한 적 없는 주소의 화면에 "보냈어요"가 남아 거짓 안내가 된다.
  it("다른 이메일로 다시 가입하면 직전의 재발송 성공 문구가 남지 않는다", async () => {
    post
      .mockResolvedValueOnce(undefined) // 재발송 성공
      .mockResolvedValueOnce(undefined); // 새 이메일로 가입 성공
    await renderVerifyStep();

    await clickResend();
    expect(screen.getByText(SUCCESS_MESSAGE)).toBeDefined();

    await restartSignupWith("other@example.com");

    expect(screen.getByText("other@example.com")).toBeDefined();
    expect(screen.queryByText(SUCCESS_MESSAGE)).toBeNull();
  });

  it("다른 이메일로 다시 가입하면 직전의 재발송 실패 문구도 남지 않는다", async () => {
    post
      .mockRejectedValueOnce(new TypeError("Failed to fetch")) // 재발송 실패
      .mockResolvedValueOnce(undefined); // 새 이메일로 가입 성공
    await renderVerifyStep();

    await clickResend();
    expect(screen.getByText(NETWORK_MESSAGE)).toBeDefined();

    await restartSignupWith("other@example.com");

    expect(screen.getByText("other@example.com")).toBeDefined();
    expect(screen.queryByText(NETWORK_MESSAGE)).toBeNull();
  });

  // 재발송 결과는 버튼에 포커스가 머문 채 비동기로 나타난다 —
  // 문단을 그냥 끼워 넣으면 스크린리더 사용자는 성공·실패를 전혀 통보받지 못한다.
  it("재발송 결과를 보조기술이 읽을 수 있게 노출한다", async () => {
    post
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderVerifyStep();

    await clickResend();
    expect(screen.getByRole("status").textContent).toBe(SUCCESS_MESSAGE);

    await clickResend();
    expect(screen.getByRole("alert").textContent).toBe(NETWORK_MESSAGE);
  });
});
