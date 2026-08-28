import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// FRT-340: 비밀번호 재설정 각 단계의 실패 문구는 버튼에 포커스가 머문 채 비동기로 나타난다.
// 역할을 주지 않으면 스크린리더 사용자에게는 아무 일도 일어나지 않은 것과 같다
// — 회원가입 흐름은 FRT-282 에서 같은 처방을 이미 받았고, 이 화면은 그 범위 밖이라 남아 있었다.
// 여기서 보는 건 문구가 아니라 "실패가 프로그램적으로 알려지는가" 다.

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

const NETWORK_MESSAGE = "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.";

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

/** 지금 화면에 낭독될 실패 문구가 하나도 없다 — 지난 실패가 되살아나지 않았는지 본다. */
function assertNothingAnnounced() {
  expect(screen.queryAllByRole("alert")).toHaveLength(0);
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

async function renderPage() {
  render(<ForgotPasswordPage />);
  await act(async () => {});
}

describe("비밀번호 찾기 — 실패를 보조기술에 알린다", () => {
  it("재설정 코드 발송에 실패하면 실패 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    requestReset.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderPage();

    await advanceToCodeStep();

    assertAnnounced(NETWORK_MESSAGE);
  });

  it("인증 코드 확인에 실패하면 실패 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    verifyCode.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderPage();

    await advanceToCodeStep();
    await advanceToPasswordStep();

    assertAnnounced(NETWORK_MESSAGE);
  });

  it("새 비밀번호 설정에 실패하면 실패 사실이 즉시 읽히는 영역으로 노출된다", async () => {
    reset.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderPage();

    await advanceToCodeStep();
    await advanceToPasswordStep();

    await typeInto("새 비밀번호", "arcpass123");
    await typeInto("새 비밀번호 확인", "arcpass123");
    await clickButton("비밀번호 변경하기");

    assertAnnounced(NETWORK_MESSAGE);
  });

  // 실패 문구를 남겨둔 채 스텝을 벗어났다 돌아오면 요소가 리마운트되고, role="alert" 는
  // 마운트되는 순간을 "새 알림"으로 읽는다 — 아직 아무것도 다시 시도하지 않았는데
  // 지난 실패가 다시 낭독되는 건 알려주는 게 아니라 속이는 것이다(FRT-282).
  it("코드 확인에 실패한 뒤 되돌아갔다 다시 들어오면 지난 실패를 다시 읽지 않는다", async () => {
    verifyCode.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderPage();

    await advanceToCodeStep();
    await advanceToPasswordStep();
    assertAnnounced(NETWORK_MESSAGE);

    await clickButton("← 이전"); // code → email
    await clickButton("재설정 코드 받기"); // email → code (리마운트)

    assertNothingAnnounced();
  });

  // 「← 이전」은 요청이 비행 중에도 눌린다(isLoading 으로 막지 않는다). 그래서 뒤늦게 도착한
  // 실패가 이미 떠난 스텝의 문구를 채울 수 있다 — 그 문구가 화면 어딘가에 낭독되면 사용자는
  // 지금 서 있는 자리와 무관한 실패를 듣게 된다.
  //
  // 지금은 실패 문구가 각자의 스텝 안에서만 렌더되어(조건부 렌더) 떠난 뒤엔 낭독될 자리가 없고,
  // 되돌아오는 유일한 경로인 「재설정 코드 받기」 성공이 codeError 를 비운다. 그 두 성질이
  // 이 화면의 방어 전부다 — 문구를 공용 배너로 끌어올리는 순간 무너지므로 여기에 못 박는다.
  it("응답을 기다리는 사이 스텝을 떠났다면 뒤늦게 온 실패를 읽지 않는다", async () => {
    let failVerify!: (reason: unknown) => void;
    verifyCode.mockReturnValueOnce(
      new Promise<never>((_resolve, rejectVerify) => {
        failVerify = rejectVerify;
      }),
    );
    await renderPage();

    await advanceToCodeStep();
    await typeInto("인증 코드", "123456");
    await clickButton("확인"); // 요청은 아직 비행 중

    await clickButton("← 이전"); // code → email

    await act(async () => {
      failVerify(new TypeError("Failed to fetch")); // 이제서야 지난 요청이 실패한다
    });

    assertNothingAnnounced();
  });
});
