import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Experience } from "@/types/experience";

/**
 * FRT-109 — 레쥬메 생성 시 경험 선택.
 *
 * 핵심은 "기본 전체 선택"과 "선택 0개면 생성 차단", 그리고 **플래그 off 일 때 현행과
 * 완전히 동일**하다는 것(백엔드가 experience_ids 를 조용히 무시하므로, 게이트가 새면
 * 사용자가 고른 대로 나오지 않는데도 성공으로 보인다).
 */

const mockCreateResume = vi.fn();
const mockCapture = vi.fn();

vi.mock("@/lib/api/export-api", () => ({
  createResume: (...args: unknown[]) => mockCreateResume(...args),
}));
vi.mock("@/lib/analytics", () => ({
  capture: (...args: unknown[]) => mockCapture(...args),
}));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }));

let mockExperiences: Experience[] = [];
let mockLoading = false;
let mockError: Error | null = null;
const mockRefetch = vi.fn();

vi.mock("@/hooks/useExperiences", () => ({
  useExperiences: () => ({
    experiences: mockExperiences,
    isLoading: mockLoading,
    error: mockError,
    refetch: mockRefetch,
  }),
}));

import { CreateResumeModal } from "./CreateResumeModal";

function experience(id: string, title: string, updatedAt: string): Experience {
  return {
    id,
    user_id: "u1",
    type: "career",
    importance: null,
    content: {
      schema_version: 2,
      template_version: 1,
      title,
      summary: "",
      status: "draft",
      tags: [],
      fields: {},
      custom: [],
    },
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockLoading = false;
  mockError = null;
  mockExperiences = [
    experience("e1", "ARC 인턴", "2026-07-20T00:00:00.000Z"),
    experience("e2", "학회 발표", "2026-07-21T00:00:00.000Z"),
    experience("e3", "봉사활동", "2026-07-19T00:00:00.000Z"),
  ];
  mockCreateResume.mockResolvedValue({ id: null });
});

function renderModal(enabled: boolean) {
  return render(
    <CreateResumeModal
      open
      onClose={() => {}}
      onCreated={() => {}}
      experienceSelectionEnabled={enabled}
    />,
  );
}

describe("CreateResumeModal — 경험 선택 (플래그 on)", () => {
  it("기본은 전체 선택이고, 전부 실어 보낸다", async () => {
    const user = userEvent.setup();
    renderModal(true);

    expect(screen.getByText("3 / 3개")).toBeTruthy();
    for (const box of screen.getAllByRole("checkbox")) {
      expect((box as HTMLInputElement).checked).toBe(true);
    }

    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(mockCreateResume).toHaveBeenCalled());
    const [params] = mockCreateResume.mock.calls[0];
    expect(new Set(params.experienceIds)).toEqual(new Set(["e1", "e2", "e3"]));
  });

  it("해제한 경험만 빠진 채 전송한다", async () => {
    const user = userEvent.setup();
    renderModal(true);

    // 최근 수정순 정렬이라 첫 행은 e2(7/21)다 — 목록 순서가 아니라 라벨로 집는다.
    await user.click(screen.getByRole("checkbox", { name: /ARC 인턴/ }));
    expect(screen.getByText("2 / 3개")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(mockCreateResume).toHaveBeenCalled());
    const [params] = mockCreateResume.mock.calls[0];
    expect(new Set(params.experienceIds)).toEqual(new Set(["e2", "e3"]));
  });

  it("전체 해제하면 '만들기'가 비활성이고 생성도 호출되지 않는다", async () => {
    const user = userEvent.setup();
    renderModal(true);

    await user.click(screen.getByRole("button", { name: "전체 해제" }));
    expect(screen.getByText("0 / 3개")).toBeTruthy();

    const submit = screen.getByRole("button", { name: "만들기" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await user.click(submit);
    expect(mockCreateResume).not.toHaveBeenCalled();
  });

  it("기록한 경험이 없으면 안내를 띄우고 생성을 막는다", () => {
    mockExperiences = [];
    renderModal(true);

    expect(screen.getByText("아직 기록한 경험이 없어요.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "만들기" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("경험 목록 로드에 실패하면 생성을 막는다 — 무엇이 들어갈지 알 수 없다", () => {
    mockError = new Error("boom");
    renderModal(true);

    expect(
      (screen.getByRole("button", { name: "만들기" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  // 훅은 마운트 때 한 번만 읽는다 — 재시도 버튼이 없으면 실패한 사용자는 모달을 닫았다
  // 여는 것 말고 복구 수단이 없다.
  it("로드 실패 화면에서 다시 시도할 수 있다", async () => {
    const user = userEvent.setup();
    mockError = new Error("boom");
    renderModal(true);

    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("선택 개수를 계측에 싣는다", async () => {
    const user = userEvent.setup();
    renderModal(true);

    await user.click(screen.getByRole("checkbox", { name: /봉사활동/ }));
    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(mockCapture).toHaveBeenCalled());
    expect(mockCapture).toHaveBeenCalledWith("export_completed", {
      export_type: "resume",
      language: "ko",
      experience_count: 2,
    });
  });
});

describe("CreateResumeModal — 플래그 off (백엔드 미수용 봉인)", () => {
  it("선택 UI 를 렌더하지 않는다", () => {
    renderModal(false);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.getByText(/지금까지 기록한 모든 경험을 바탕으로/),
    ).toBeTruthy();
  });

  it("experienceIds 를 전송하지 않는다 — 계약상 부재 = 전체 경험(현행 동작)", async () => {
    const user = userEvent.setup();
    renderModal(false);

    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(mockCreateResume).toHaveBeenCalled());
    const [params] = mockCreateResume.mock.calls[0];
    expect("experienceIds" in params).toBe(false);
  });

  it("경험이 0개여도 생성을 막지 않는다 — 차단은 선택 기능의 일부다", () => {
    mockExperiences = [];
    renderModal(false);
    expect(
      (screen.getByRole("button", { name: "만들기" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("계측에 experience_count 를 싣지 않는다", async () => {
    const user = userEvent.setup();
    renderModal(false);

    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(mockCapture).toHaveBeenCalled());
    expect(mockCapture).toHaveBeenCalledWith("export_completed", {
      export_type: "resume",
      language: "ko",
    });
  });
});
