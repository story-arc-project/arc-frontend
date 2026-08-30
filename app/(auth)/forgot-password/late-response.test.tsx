import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// FRT-343: 「← 이전」은 요청이 비행 중에도 눌린다(isLoading 으로 막지 않는다).
// 그래서 사용자가 스스로 물러난 뒤에 도착한 응답이 화면을 다음 단계로 끌고 갈 수 있다.
// 여기서 보는 건 문구가 아니라 **"떠난 흐름의 응답이 지금 화면을 움직일 자격이 있는가"** 다.
//
// 회원가입 흐름은 FRT-282(PR #294)에서 같은 결함을 세대 카운터로 고쳤다. 이 파일은 그
// 장치가 이 화면에서도 서 있는지, 그리고 **성공 쪽까지** 덮는지를 못 박는다.

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

// 인증 사용자는 이 화면에서 튕겨나간다(useRedirectIfAuthenticated). 미인증으로 고정해야 화면에 머문다.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isOnboarded: false,
    isLoading: false,
    error: null,
  }),
}));

// PASSWORD_RESET_ENABLED 는 모듈 로드 시 env 로 확정된다(stubEnv 로는 못 바꾼다).
// off 면 라우트가 스스로 /login 으로 replace 하며 null 을 렌더해 화면이 아예 없다.
vi.mock("../constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../constants")>();
  return { ...actual, PASSWORD_RESET_ENABLED: true };
});

vi.mock("@/lib/api/auth-api", () => ({
  requestPasswordReset: vi.fn(),
  verifyResetCode: vi.fn(),
  resetPassword: vi.fn(),
  logoutUser: vi.fn(),
}));

vi.mock("framer-motion", () => {
  const MOTION_ONLY_PROPS = new Set([
    "initial", "animate", "exit", "transition", "custom", "variants", "layout",
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

import { requestPasswordReset, verifyResetCode, resetPassword } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/client";

import ForgotPasswordPage from "./page";

const requestReset = vi.mocked(requestPasswordReset);
const verifyCode = vi.mocked(verifyResetCode);
const reset = vi.mocked(resetPassword);

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  requestReset.mockResolvedValue(undefined);
  verifyCode.mockResolvedValue(undefined);
  reset.mockResolvedValue(undefined);
});

/** 응답 도착 시점을 테스트가 쥔다 — "비행 중"과 "뒤늦게 도착"을 갈라 놓기 위해. */
function deferred() {
  let settle!: { resolve: () => void; reject: (reason: unknown) => void };
  const promise = new Promise<void>((resolve, reject) => {
    settle = { resolve: () => resolve(), reject };
  });
  return { promise, ...settle };
}

const HEADING = {
  email: "비밀번호를 잊으셨나요?",
  code: "인증 코드를 입력해주세요",
  password: "새 비밀번호를 설정해주세요",
} as const;

/** 지금 서 있는 단계 — 화면이 나를 옮겼는지 아닌지는 이 한 줄로 판정한다. */
function currentStep(): keyof typeof HEADING {
  const found = (Object.keys(HEADING) as (keyof typeof HEADING)[]).find(
    (step) => screen.queryByRole("heading", { name: HEADING[step] }) !== null,
  );
  if (!found) throw new Error("어느 단계도 렌더되지 않았다");
  return found;
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

async function renderPage() {
  render(<ForgotPasswordPage />);
  await act(async () => {});
}

/** email 스텝에서 코드 발송에 성공해 code 스텝으로 넘어간다. */
async function advanceToCodeStep(email = "test@example.com") {
  await typeInto("이메일", email);
  await clickButton("재설정 코드 받기");
}

/** code 스텝에서 코드 검증에 성공해 password 스텝으로 넘어간다. */
async function advanceToPasswordStep() {
  await typeInto("인증 코드", "123456");
  await clickButton("확인");
}

/** password 스텝에서 유효한 새 비밀번호를 채운다(제출은 하지 않는다). */
async function fillNewPassword() {
  await typeInto("새 비밀번호", "arcpass123");
  await typeInto("새 비밀번호 확인", "arcpass123");
}

describe("비밀번호 찾기 — 떠난 흐름의 응답은 화면을 옮기지 않는다", () => {
  // 가드가 정상 흐름까지 막으면 고친 게 아니라 부순 것이다. 먼저 그 쪽을 못 박는다.
  it("스텝에 머물러 있었다면 코드 확인 성공은 그대로 비밀번호 단계로 넘어간다", async () => {
    await renderPage();

    await advanceToCodeStep();
    await advanceToPasswordStep();

    expect(currentStep()).toBe("password");
  });

  // 이 이슈의 본체. 사용자는 이메일을 고치려고 **의도적으로** 물러났는데,
  // 뒤늦게 도착한 검증 성공이 자기가 하지 않은 이동을 일으킨다.
  it("응답을 기다리는 사이 물러났다면 뒤늦게 온 코드 확인 성공이 다음 단계로 끌고 가지 않는다", async () => {
    const verifying = deferred();
    verifyCode.mockReturnValueOnce(verifying.promise);
    await renderPage();

    await advanceToCodeStep();
    await typeInto("인증 코드", "123456");
    await clickButton("확인"); // 요청은 아직 비행 중

    await clickButton("← 이전"); // code → email
    expect(currentStep()).toBe("email");

    await act(async () => {
      verifying.resolve(); // 이제서야 지난 요청이 성공한다
    });

    expect(currentStep()).toBe("email");
  });

  // 실패도 화면을 끌고 간다 — handleReset 의 410 분기는 goTo("code", -1) 로 되돌린다.
  // 사용자가 이미 이메일 단계까지 물러난 뒤라면 그 되돌림은 그냥 납치다.
  it("응답을 기다리는 사이 물러났다면 뒤늦게 온 코드 만료 실패가 코드 단계로 끌고 가지 않는다", async () => {
    const resetting = deferred();
    reset.mockReturnValueOnce(resetting.promise);
    await renderPage();

    await advanceToCodeStep();
    await advanceToPasswordStep();
    await fillNewPassword();
    await clickButton("비밀번호 변경하기"); // 요청은 아직 비행 중

    await clickButton("← 이전"); // password → code
    await clickButton("← 이전"); // code → email
    expect(currentStep()).toBe("email");

    await act(async () => {
      resetting.reject(new ApiError(410, "expired"));
    });

    expect(currentStep()).toBe("email");
  });

  // 세대 가드의 예외를 못 박는다. 비밀번호는 **이미 바뀌었다** — 되돌릴 수 없는 부수효과다.
  // 이동을 막으면 사용자는 아무 안내 없이 코드 단계에 남아, 이미 쓴 코드를 다시 넣어보게 된다.
  // 감추는 것보다 알리는 것이 낫다: 떠난 흐름이어도 이 성공만은 로그인 화면으로 데려간다.
  it("떠난 뒤 도착했더라도 비밀번호 변경 성공은 로그인 화면으로 알린다", async () => {
    const resetting = deferred();
    reset.mockReturnValueOnce(resetting.promise);
    await renderPage();

    await advanceToCodeStep();
    await advanceToPasswordStep();
    await fillNewPassword();
    await clickButton("비밀번호 변경하기"); // 요청은 아직 비행 중

    await clickButton("← 이전"); // password → code

    await act(async () => {
      resetting.resolve();
    });

    expect(pushMock).toHaveBeenCalledWith("/login?reset=1");
  });

  // 재발송 안내는 그 회차 그 화면에 매인 진술이다. 재발송은 isResending 으로만 막혀
  // 이메일 단계의 「재설정 코드 받기」를 잠그지 않으므로, 비행 중에 새 코드 흐름을 열 수 있다.
  // 그 새 화면에 지난 회차의 "다시 보냈어요"가 찍히면 사용자는 하지 않은 일을 들은 것이 된다.
  it("떠난 뒤 도착한 재발송 안내를 새 코드 화면에 남기지 않는다", async () => {
    const resending = deferred();
    let calls = 0;
    requestReset.mockImplementation(() => {
      calls += 1;
      return calls === 2 ? resending.promise : Promise.resolve(undefined);
    });
    await renderPage();

    await advanceToCodeStep(); // 1회차: 최초 발송
    await clickButton("코드 재발송"); // 2회차: 비행 중
    await clickButton("← 이전"); // code → email
    await clickButton("재설정 코드 받기"); // 3회차: 새 코드 흐름
    expect(currentStep()).toBe("code");

    await act(async () => {
      resending.resolve(); // 이제서야 지난 회차 재발송이 성공한다
    });

    expect(screen.queryByText("코드를 다시 보냈어요.")).toBeNull();
  });
});
