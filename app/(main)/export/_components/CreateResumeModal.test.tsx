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

function experience(
  id: string,
  title: string,
  updatedAt: string,
  type = "career",
): Experience {
  return {
    id,
    user_id: "u1",
    type,
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
    experience("e1", "ARC 인턴", "2026-07-20T00:00:00.000Z", "career"),
    experience("e2", "학회 발표", "2026-07-21T00:00:00.000Z", "academic-society"),
    experience("e3", "봉사활동", "2026-07-19T00:00:00.000Z", "volunteer"),
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

  // FRT-114 — "사용자가 자신의 어떤 경험을 이력서에 낼 만하다고 판단하는가".
  // export_completed 는 개수만 싣고 유형을 모르며, 생성이 실패하면 아예 뜨지 않는다.
  it("선택한 경험의 개수와 유형을 계측한다 — 유형은 중복 없이", async () => {
    const user = userEvent.setup();
    renderModal(true);

    // e1(career)·e3(volunteer) 만 남긴다 — e2(academic-society) 해제.
    await user.click(screen.getByRole("checkbox", { name: /학회 발표/ }));
    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith("resume_experience_selected", {
        count: 2,
        experience_types: ["career", "volunteer"],
      }),
    );
  });

  it("같은 유형을 여러 개 골라도 유형은 한 번만 실린다", async () => {
    const user = userEvent.setup();
    mockExperiences = [
      experience("e1", "A 인턴", "2026-07-20T00:00:00.000Z", "career"),
      experience("e2", "B 인턴", "2026-07-21T00:00:00.000Z", "career"),
    ];
    renderModal(true);

    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith("resume_experience_selected", {
        count: 2,
        experience_types: ["career"],
      }),
    );
  });

  // 생성 요청 실패는 곧 drop-off 다. 선택을 요청 **직전**에 쏘지 않으면
  // "골랐는데 만들어지지 않은" 사용자가 데이터에서 통째로 사라진다.
  it("생성 요청이 실패해도 선택 사실은 남는다", async () => {
    const user = userEvent.setup();
    mockCreateResume.mockRejectedValue(new Error("boom"));
    renderModal(true);

    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith(
        "resume_experience_selected",
        expect.objectContaining({ count: 3 }),
      ),
    );
    expect(
      mockCapture.mock.calls.some(([name]) => name === "export_completed"),
    ).toBe(false);
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

  // 플래그가 꺼져 있으면 "고른다"는 개념 자체가 없다. 전체가 자동으로 들어가는 걸
  // 사용자의 선택으로 기록하면 유형 분포가 통째로 거짓이 된다(FRT-114).
  it("resume_experience_selected 를 쏘지 않는다 — 고른 적이 없다", async () => {
    const user = userEvent.setup();
    renderModal(false);

    await user.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(mockCreateResume).toHaveBeenCalled());
    expect(
      mockCapture.mock.calls.some(
        ([name]) => name === "resume_experience_selected",
      ),
    ).toBe(false);
  });
});
