import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SelectableExperience } from "@/types/analysis";

// FRT-176: 이 화면이 지키는 계약은 하나다 — "분석을 걸면 기다리게 하지 않고 목록으로 보낸다".
// 예전에는 여기서 60초 예산으로 폴링하다가 예산이 끝나면 "시간 초과" 오류를 띄웠다.
// 분석은 실패한 적이 없었고 화면만 거짓말을 했다.

vi.mock("@/lib/api/analysis-api", () => ({
  getSelectableExperiences: vi.fn(),
  createComprehensiveAnalysis: vi.fn(),
}));

vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn() };
});

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import {
  getSelectableExperiences,
  createComprehensiveAnalysis,
} from "@/lib/api/analysis-api";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";
import { capture } from "@/lib/analytics";

import ComprehensiveNewPage from "./page";

const getExperiences = vi.mocked(getSelectableExperiences);
const createAnalysis = vi.mocked(createComprehensiveAnalysis);
const toastMock = vi.mocked(toast);
const captureMock = vi.mocked(capture);

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function exp(id: string): SelectableExperience {
  return { id, title: `경험 ${id}`, type: "club", importance: 3, isComplete: true };
}

async function flush() {
  await act(async () => {});
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function renderAndSelectTwo() {
  getExperiences.mockResolvedValue([exp("a"), exp("b")]);
  const view = render(<ComprehensiveNewPage />);
  await flush();
  await click(screen.getByText("경험 a"));
  await click(screen.getByText("경험 b"));
  return view;
}

describe("새 종합 분석 — 걸어두고 목록으로 (FRT-176)", () => {
  it("분석을 걸면 대기 화면 없이 목록으로 보내고, 방금 만든 id 를 함께 넘긴다", async () => {
    await renderAndSelectTwo();
    createAnalysis.mockResolvedValue({ analysisId: "comp-9" });

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    expect(createAnalysis).toHaveBeenCalledWith(["a", "b"]);
    expect(push).toHaveBeenCalledWith("/analysis/comprehensive?started=comp-9");
    expect(toastMock).toHaveBeenCalledTimes(1);
    // 대기 화면은 이제 존재하지 않는다.
    expect(screen.queryByText("분석 중입니다...")).not.toBeInTheDocument();
  });

  it("백엔드가 id 를 주지 않으면 추적 대상 없이 목록으로만 보낸다", async () => {
    await renderAndSelectTwo();
    createAnalysis.mockResolvedValue({ analysisId: null });

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    expect(push).toHaveBeenCalledWith("/analysis/comprehensive");
  });

  it("id 에 특수문자가 있어도 쿼리로 안전하게 싣는다", async () => {
    await renderAndSelectTwo();
    createAnalysis.mockResolvedValue({ analysisId: "a b&c" });

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    expect(push).toHaveBeenCalledWith("/analysis/comprehensive?started=a%20b%26c");
  });

  it("생성 요청 자체가 실패하면 오류 화면을 보여준다 — 이건 진짜 실패다", async () => {
    await renderAndSelectTwo();
    createAnalysis.mockRejectedValue(new Error("network"));

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("분석 요청에 실패했습니다.");
  });

  it("서버가 받았는데(2xx) 본문만 깨진 건 거절이 아니다 — accepted 는 응답 상태로 가른다", async () => {
    await renderAndSelectTwo();
    createAnalysis.mockRejectedValue(new ApiError(200, "응답 형식이 올바르지 않아요.", "INVALID_JSON"));

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    expect(captureMock).toHaveBeenCalledWith("analysis_requested", {
      analysis_type: "comprehensive",
      accepted: true,
    });
  });

  it("서버가 거절하면(4xx/5xx) accepted:false 로 남는다", async () => {
    await renderAndSelectTwo();
    createAnalysis.mockRejectedValue(new ApiError(500, "오류가 발생했어요."));

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    expect(captureMock).toHaveBeenCalledWith("analysis_requested", {
      analysis_type: "comprehensive",
      accepted: false,
    });
  });

  it("응답 자체가 없으면(raw 예외) requested 를 아예 쏘지 않는다", async () => {
    await renderAndSelectTwo();
    createAnalysis.mockRejectedValue(new Error("network"));

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    expect(
      captureMock.mock.calls.filter((c) => c[0] === "analysis_requested"),
    ).toHaveLength(0);
  });

  it("요청이 나가 있는 동안 버튼을 다시 누를 수 없다", async () => {
    await renderAndSelectTwo();
    let settle!: (value: { analysisId: string | null }) => void;
    createAnalysis.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    const button = screen.getByRole("button", { name: "분석을 시작하는 중..." });
    expect(button).toBeDisabled();

    await act(async () => {
      settle({ analysisId: "comp-9" });
    });
    expect(createAnalysis).toHaveBeenCalledTimes(1);
  });

  it("응답이 오기 전에 화면을 떠나면, 뒤늦게 온 응답이 보던 화면을 빼앗지 않는다", async () => {
    const { unmount } = await renderAndSelectTwo();
    let settle!: (value: { analysisId: string | null }) => void;
    createAnalysis.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );

    await click(screen.getByRole("button", { name: "분석 시작" }));
    await flush();

    // '목록으로' 링크나 전역 내비게이션으로 이탈 — 이 화면은 사라진다.
    unmount();
    await act(async () => {
      settle({ analysisId: "comp-9" });
    });

    expect(push).not.toHaveBeenCalled();
    // 시작했다는 사실 자체는 알린다 — 요청은 실제로 나갔고 분석은 돌고 있다.
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("경험을 2개 미만 고르면 시작할 수 없다", async () => {
    getExperiences.mockResolvedValue([exp("a"), exp("b")]);
    render(<ComprehensiveNewPage />);
    await flush();

    expect(screen.getByRole("button", { name: "분석 시작" })).toBeDisabled();

    await click(screen.getByText("경험 a"));
    expect(screen.getByRole("button", { name: "분석 시작" })).toBeDisabled();

    await click(screen.getByText("경험 b"));
    expect(screen.getByRole("button", { name: "분석 시작" })).toBeEnabled();
  });
});
