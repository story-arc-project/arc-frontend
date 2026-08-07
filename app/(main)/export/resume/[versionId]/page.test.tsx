import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ResumeVersion } from "@/types/resume";

/**
 * FRT-114 — 엑스포트 이후 행동 계측.
 *
 * `export_completed` 까지만 보면 "만들어놓고 안 쓰는지"가 안 보인다. 여기서 잡는 건 셋이다:
 * 결과물을 실제로 꺼내갔는가(`resume_downloaded`), AI 초안에 손을 댔는가(`resume_edited`),
 * 그 편집이 **어디까지 갔는가**(`resume_edit_saved`).
 *
 * 로컬·CI 는 PostHog 키가 없어 `capture` 가 no-op 이다 — 발화/미발화를 눈으로 확인할 방법이
 * 없으므로 이 파일이 유일한 증거다.
 */

const mockCapture = vi.fn();
const mockGetResume = vi.fn();
const mockUpdateResume = vi.fn();
const mockCreateResume = vi.fn();
const mockDownloadBlob = vi.fn();
const mockRenderPdf = vi.fn();
const mockRenderDocx = vi.fn();
const mockPush = vi.fn();

vi.mock("@/lib/analytics", () => ({
  capture: (...args: unknown[]) => mockCapture(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }));

vi.mock("@/components/ui/toast", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api/export-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/export-api")>();
  return {
    ...actual,
    getResume: (...args: unknown[]) => mockGetResume(...args),
    updateResume: (...args: unknown[]) => mockUpdateResume(...args),
    createResume: (...args: unknown[]) => mockCreateResume(...args),
  };
});

// 파일 생성기는 무거운 동적 import 다 — 실제로 PDF 를 만들 이유가 없다.
vi.mock("@/lib/export/download", () => ({
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
  resumeFileName: () => "레쥬메_20260731.pdf",
}));
vi.mock("@/lib/export/resume-pdf", () => ({
  renderResumePdf: (...args: unknown[]) => mockRenderPdf(...args),
}));
vi.mock("@/lib/export/resume-docx", () => ({
  renderResumeDocx: (...args: unknown[]) => mockRenderDocx(...args),
}));

import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import ResumeDetailPage from "./page";

function resumeFixture(overrides: Partial<ResumeVersion> = {}): ResumeVersion {
  return {
    meta: {
      language: "ko",
      format: "json",
      generated_at: "2026-07-21T00:00:00Z",
      source_chars: 100,
    },
    인적사항: {
      이름: "김서윤",
      영문명: null,
      생년월일: null,
      이메일: null,
      전화번호: null,
      주소: null,
      링크: [],
    },
    학력: [],
    경력: [],
    자격증: [],
    어학: [],
    대외활동: [],
    프로젝트: [],
    수상: [],
    기술및역량: { 기술스택: [], 툴: [], 소프트스킬: [] },
    동아리_학회: [],
    연계성: [],
    자기소개_요약: "AI 가 쓴 초안 문장입니다.",
    파싱경고: [],
    ...overrides,
  };
}

/**
 * 상세가 로드돼 편집기가 뜰 때까지 기다린다.
 *
 * 페이지가 `use(params)` 로 서스펜드하므로 렌더 자체를 await 된 act 로 감싼다 —
 * 안 감싸면 서스펜션이 act 스코프 밖에서 풀려 화면이 영영 비어 있다.
 */
async function renderLoaded() {
  const params = Promise.resolve({ versionId: "v1" });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={null}>
        <ResumeDetailPage params={params} />
      </Suspense>,
    );
  });
  await screen.findByLabelText("이름");
  return result;
}

function captured(name: string): unknown[][] {
  return mockCapture.mock.calls.filter(([n]) => n === name);
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.print = vi.fn();
  mockGetResume.mockResolvedValue(resumeFixture());
  mockRenderPdf.mockResolvedValue(new Blob(["pdf"]));
  mockRenderDocx.mockResolvedValue(new Blob(["docx"]));
});

describe("resume_downloaded — 만든 레쥬메를 실제로 꺼내갔는가", () => {
  it("PDF 다운로드가 끝나면 형식과 언어를 싣고 한 번 발화한다", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "내보내기" }));
    await user.click(screen.getByRole("button", { name: /PDF/ }));

    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalled());
    expect(captured("resume_downloaded")).toEqual([
      ["resume_downloaded", { format: "pdf", language: "ko" }],
    ]);
  });

  it("Word 는 format 으로만 갈린다", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "내보내기" }));
    await user.click(screen.getByRole("button", { name: /Word/ }));

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith("resume_downloaded", {
        format: "docx",
        language: "ko",
      }),
    );
  });

  // 파일이 손에 안 떨어졌는데 "받아갔다"로 세면, 지표가 정확히 반대로 읽힌다
  // (생성기 버그가 심할수록 다운로드 수치가 멀쩡해 보인다).
  it("파일 생성에 실패하면 발화하지 않는다", async () => {
    const user = userEvent.setup();
    mockRenderPdf.mockRejectedValue(new Error("boom"));
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "내보내기" }));
    await user.click(screen.getByRole("button", { name: /PDF/ }));

    await waitFor(() => expect(mockRenderPdf).toHaveBeenCalled());
    expect(mockDownloadBlob).not.toHaveBeenCalled();
    expect(captured("resume_downloaded")).toEqual([]);
  });

  // 인쇄는 파일이 떨어지지 않지만 "결과물을 꺼내가는 행동"은 같다 — 안 실으면
  // 그 경로는 영영 데이터에 안 남는다(다운스트림에서 접는 건 언제든 가능).
  it("인쇄도 같은 이벤트에 format='print' 로 싣는다", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "내보내기" }));
    await user.click(screen.getByRole("button", { name: /인쇄/ }));

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith("resume_downloaded", {
        format: "print",
        language: "ko",
      }),
    );
  });
});

describe("resume_edited — AI 초안에 손을 댔는가", () => {
  it("처음 고친 섹션을 싣고 한 번만 발화한다", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await waitFor(() => expect(captured("resume_edited").length).toBe(1));
    // version_id — "버전당 1회"는 **한 화면 안에서만** 참이다. 새로고침·재방문·두 번째 탭은
    // 각자 새 페이지라 같은 레쥬메가 다시 발화한다. 버전 식별자가 없으면 다운스트림이
    // 그 중복을 접을 수도, 서로 다른 레쥬메의 편집과 가를 수도 없다(analysis_completed 전례).
    expect(captured("resume_edited")[0][1]).toEqual({
      section: "personal_info",
      version_id: "v1",
    });

    // 계속 타이핑해도 다시 쏘지 않는다 — 키 입력마다 발화하면 이벤트가 폭증한다.
    await user.type(screen.getByLabelText("이름"), "!!");
    await user.type(screen.getByLabelText("영문명"), "Kim");
    expect(captured("resume_edited").length).toBe(1);
  });

  // 복원은 사용자의 편집이 아니라 **이전 세션 편집의 복구**다. 여기서 쏘면
  // "AI 결과에 손댔다"가 거짓이 되고, 그 편집은 이미 지난 세션에서 한 번 잡혔다.
  it("임시저장 복원만으로는 발화하지 않는다", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "arc:resume-draft:v1",
      JSON.stringify({
        data: resumeFixture({ 자기소개_요약: "지난 세션에 고친 문장" }),
        // resume.meta.generated_at 보다 나중이어야 복원 배너가 뜬다.
        updated_at: "2026-07-22T00:00:00Z",
      }),
    );
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "복원" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "복원" })).toBeNull(),
    );
    expect(captured("resume_edited")).toEqual([]);
  });
});

describe("resume_edit_saved — 그 편집이 어디까지 갔는가", () => {
  it("서버 저장에 성공하면 outcome='server' 와 고친 섹션을 싣는다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockImplementation(async (_id, data) => data);
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith("resume_edit_saved", {
        outcome: "server",
        persisted: true,
        sections: ["personal_info"],
        section_count: 1,
      }),
    );
  });

  // 서버에 PATCH 가 실재하므로(FRT-111) 405/501 은 배포 상태에서 나올 수 없다. 그래도
  // 온다면(구 백엔드 롤백) 그건 **저장 실패**일 뿐 별도 갈래가 아니다 — 편집은 임시
  // 저장으로 붙들고, 지표에는 서버에 안 남았다는 사실이 failed 로 정직하게 남는다.
  it.each([405, 501])(
    "%i 도 outcome='failed' 로 남고 편집은 임시 저장된다",
    async (status) => {
      const user = userEvent.setup();
      mockUpdateResume.mockRejectedValue(new ApiError(status, "unsupported"));
      await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      await user.click(screen.getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(mockCapture).toHaveBeenCalledWith("resume_edit_saved", {
          outcome: "failed",
          persisted: true,
          sections: ["personal_info"],
          section_count: 1,
        }),
      );
    },
  );

  it("그 외 오류는 outcome='failed'", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockRejectedValue(new Error("boom"));
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith(
        "resume_edit_saved",
        expect.objectContaining({ outcome: "failed" }),
      ),
    );
  });

  // 4xx 는 다시 시도해도 같은 결과다. BAC-56 이 PATCH 를 배포한 뒤로 422 는 "저장 경로가
  // 없다"가 아니라 **입력이 규칙을 어겼다**는 뜻인데, "잠시 후 다시 시도해주세요"로 뭉개면
  // 사용자는 자기가 고칠 수 있는 것을 못 고친 채 재시도만 반복한다.
  it("4xx 는 서버가 준 사유를 그대로 안내한다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockRejectedValue(
      new ApiError(422, "제목은 100자를 넘을 수 없어요."),
    );
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("제목은 100자를 넘을 수 없어요."),
    );
  });

  // 400 은 예외다 — 서버가 이 코드를 내는 분기는 "아직 생성이 안 끝난 레쥬메"
  // 하나뿐인데(`patch_resume`), 그 메시지가 영문("Resume is not completed yet.")이라
  // 그대로 띄우면 사용자가 읽지 못한다. 사유를 보여주는 규칙보다 **읽히는 것**이 먼저다.
  it("400 은 서버 영문 메시지 대신 생성 중이라는 한글 안내를 보여준다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockRejectedValue(
      new ApiError(400, "Resume is not completed yet."),
    );
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "아직 레쥬메를 만드는 중이에요. 완성되면 저장할 수 있어요.",
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      "Resume is not completed yet.",
    );
  });

  // 반대쪽도 지켜야 한다 — 5xx·네트워크 장애는 실제로 잠시 후면 된다. 사유("오류가
  // 발생했어요")를 앞세우면 사용자는 재시도라는 **유효한 다음 행동**을 잃는다.
  it("5xx 는 재시도 안내를 유지한다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockRejectedValue(new ApiError(503, "오류가 발생했어요."));
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "저장에 실패했어요. 잠시 후 다시 시도해주세요.",
      ),
    );
  });

  // 서버도 로컬도 못 남긴 = **편집 유실**. outcome 만으로는 이 최악의 경우가 안 보인다.
  it("임시저장까지 실패하면 draft_saved=false 로 유실을 드러낸다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockRejectedValue(new ApiError(500, "server error"));
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    try {
      await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      await user.click(screen.getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(mockCapture).toHaveBeenCalledWith(
          "resume_edit_saved",
          expect.objectContaining({
            outcome: "failed",
            persisted: false,
          }),
        ),
      );
    } finally {
      setItem.mockRestore();
    }
  });

  // 임시 저장까지 실패하면 편집 유실 직전이다. 그렇다고 사유를 빼면 안 된다 —
  // 제목 길이 초과라면 **고쳐서 바로 저장하는 것**이 이 위기의 탈출구이기 때문이다.
  // 둘 중 하나만 말하면 사용자는 나갈 길을 모르거나, 나갈 길이 급한 줄을 모른다.
  it("임시 저장까지 실패해도 서버가 준 사유는 사라지지 않는다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockRejectedValue(
      new ApiError(422, "제목은 100자를 넘을 수 없어요."),
    );
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    try {
      await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      await user.click(screen.getByRole("button", { name: "저장" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      const message = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as string;
      expect(message).toContain("제목은 100자를 넘을 수 없어요.");
      expect(message).toContain("페이지를 닫지 마세요");
    } finally {
      setItem.mockRestore();
    }
  });

  // 요청이 도는 동안에도 편집기는 살아 있다. 임시 저장에는 **그 최신본**이 들어가는데
  // 섹션 목록만 요청 시점 스냅샷을 가리키면, 보관된 편집 일부가 지표에서 사라진다.
  it("저장 중에 이어서 고친 섹션도 임시 저장된 최신본 기준으로 싣는다", async () => {
    const user = userEvent.setup();
    let rejectSave!: (reason: unknown) => void;
    mockUpdateResume.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await user.click(screen.getByRole("button", { name: /자기소개/ }));
    await user.type(
      screen.getByPlaceholderText("간단한 자기소개를 적어주세요."),
      "x",
    );

    await act(async () => {
      rejectSave(new ApiError(500, "server error"));
    });

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith("resume_edit_saved", {
        outcome: "failed",
        persisted: true,
        sections: ["personal_info", "summary"],
        section_count: 2,
      }),
    );
  });

  it("고친 게 없으면 저장 버튼이 잠겨 있어 발화하지 않는다", async () => {
    await renderLoaded();

    expect(
      (screen.getByRole("button", { name: "저장" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(captured("resume_edit_saved")).toEqual([]);
  });

  // 저장을 누르지 않고 화면을 떠나는 경로. 사용자에게는 "임시 저장했어요"라고 **말하는데**
  // 여기서 아무것도 안 쏘면, 안전하게 보관된 편집이 유실된 편집과 데이터상 구별되지 않는다.
  describe("저장을 누르지 않고 나가는 경로", () => {
    it("나가기로 임시 저장되면 outcome='exit_draft' 로 한 번 발화한다", async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      await user.click(
        screen.getByRole("button", { name: "익스포트로 돌아가기" }),
      );

      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      expect(captured("resume_edit_saved")).toEqual([
        [
          "resume_edit_saved",
          {
            outcome: "exit_draft",
            persisted: true,
            sections: ["personal_info"],
            section_count: 1,
          },
        ],
      ]);
    });

    // 임시 저장이 실패하면 페이지는 이동을 막고 "저장 후 나가주세요"를 띄운다 —
    // 편집 유실 직전이라는 뜻인데, 지금까지 이 순간은 데이터에 전혀 남지 않았다.
    it("임시 저장이 실패하면 persisted=false 로 남기고 이동하지 않는다", async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("quota");
        });
      try {
        await user.click(
          screen.getByRole("button", { name: "익스포트로 돌아가기" }),
        );
      } finally {
        setItem.mockRestore();
      }

      expect(mockPush).not.toHaveBeenCalled();
      expect(captured("resume_edit_saved")).toEqual([
        [
          "resume_edit_saved",
          {
            outcome: "exit_draft",
            persisted: false,
            sections: ["personal_info"],
            section_count: 1,
          },
        ],
      ]);
    });

    it("고친 게 없으면 나가도 발화하지 않는다", async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(
        screen.getByRole("button", { name: "익스포트로 돌아가기" }),
      );

      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      expect(captured("resume_edit_saved")).toEqual([]);
    });

    // 상단 '나가기'만 출구가 아니다 — GNB 링크로 떠나도 페이지는 조용히 임시 저장한다.
    it("다른 경로로 떠나도(언마운트) 같은 이벤트를 남긴다", async () => {
      const user = userEvent.setup();
      const { unmount } = await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      unmount();

      expect(captured("resume_edit_saved")).toEqual([
        [
          "resume_edit_saved",
          {
            outcome: "exit_draft",
            persisted: true,
            sections: ["personal_info"],
            section_count: 1,
          },
        ],
      ]);
    });

    // '나가기'는 스스로 이동을 일으켜 곧바로 언마운트로 이어진다. 두 곳이 각각 쏘면
    // 한 번의 이탈이 두 건으로 잡혀 이탈 지표가 그대로 두 배가 된다.
    it("나가기로 이미 남겼으면 뒤따르는 언마운트는 중복 발화하지 않는다", async () => {
      const user = userEvent.setup();
      const { unmount } = await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      await user.click(
        screen.getByRole("button", { name: "익스포트로 돌아가기" }),
      );
      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      unmount();

      expect(captured("resume_edit_saved").length).toBe(1);
    });

    // 실패한 '나가기'는 이탈이 아니다 — 사용자는 화면에 그대로 남는다. 여기서 중복
    // 방지 플래그를 세워버리면, 뒤이어 진짜로 떠날 때 보관된 편집이 통째로 안 남는다.
    it("나가기가 임시 저장에 실패했다면 뒤이은 이탈은 다시 남긴다", async () => {
      const user = userEvent.setup();
      const { unmount } = await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("quota");
        });
      try {
        await user.click(
          screen.getByRole("button", { name: "익스포트로 돌아가기" }),
        );
      } finally {
        setItem.mockRestore();
      }
      expect(mockPush).not.toHaveBeenCalled();

      unmount();

      expect(captured("resume_edit_saved")).toEqual([
        [
          "resume_edit_saved",
          {
            outcome: "exit_draft",
            persisted: false,
            sections: ["personal_info"],
            section_count: 1,
          },
        ],
        [
          "resume_edit_saved",
          {
            outcome: "exit_draft",
            persisted: true,
            sections: ["personal_info"],
            section_count: 1,
          },
        ],
      ]);
    });

    // 저장에 성공했으면 남길 편집이 없다 — 나가기가 또 쏘면 저장 1회가 2건이 된다.
    it("저장에 성공한 뒤 나가면 발화하지 않는다", async () => {
      const user = userEvent.setup();
      mockUpdateResume.mockImplementation(async (_id, data) => data);
      await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      await user.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(captured("resume_edit_saved").length).toBe(1));

      await user.click(
        screen.getByRole("button", { name: "익스포트로 돌아가기" }),
      );

      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      expect(captured("resume_edit_saved").length).toBe(1);
    });
  });
});

/**
 * FRT-147 — 영문 레쥬메는 편집 사이드바를 통째로 감춘다. 파싱 경고 배너가 그 사이드바
 * 안에만 있으면 "어떤 경험을 못 읽었는지"를 영문 사용자만 영영 못 보게 된다.
 */
describe("영문 읽기 전용 — 보완 안내", () => {
  function enResume(파싱경고: string[]): ResumeVersion {
    return resumeFixture({
      meta: {
        language: "en",
        format: "western_resume",
        generated_at: "2026-07-31T00:00:00Z",
        source_chars: 100,
      },
      파싱경고,
    });
  }

  // 읽기 전용에는 편집기가 없으므로 `renderLoaded` 의 "이름" 입력칸을 기다릴 수 없다.
  async function renderReadOnly() {
    const params = Promise.resolve({ versionId: "v1" });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <ResumeDetailPage params={params} />
        </Suspense>,
      );
    });
    await screen.findByText("영문 레쥬메는 아직 편집할 수 없어요");
  }

  it("편집기가 없어도 파싱 경고를 미리보기 쪽에 보여준다", async () => {
    mockGetResume.mockResolvedValue(enResume(["경력 기간을 해석하지 못했어요"]));
    await renderReadOnly();

    // 편집기는 CSS 로 감추는 게 아니라 아예 안 그린다 — 감추기만 하면 사이드바 안의
    // 배너가 DOM 에 남아 같은 경고가 두 벌 마운트된다(그래서 개수까지 못 박는다).
    expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("경력 기간을 해석하지 못했어요"),
    ).toHaveLength(1);
  });

  it("경고가 없으면 배너를 그리지 않는다", async () => {
    mockGetResume.mockResolvedValue(enResume([]));
    await renderReadOnly();

    expect(
      screen.queryByText("이 정보를 보완하면 더 좋은 레쥬메를 만들 수 있어요"),
    ).not.toBeInTheDocument();
  });

  // 전부 빈 레쥬메는 상세 화면보다 먼저 EmptyResumeState 로 빠진다 — 그 갈래도 경고를
  // 지나쳐 간다면 화면이 "경험이 없다"고만 말하고, 실은 못 읽은 것이라는 사실이 사라진다.
  it("전부 비어도 파싱 경고는 빈 상태 위에 남는다", async () => {
    mockGetResume.mockResolvedValue({
      ...enResume(["경력 기간을 해석하지 못했어요"]),
      인적사항: {
        이름: null,
        영문명: null,
        생년월일: null,
        이메일: null,
        전화번호: null,
        주소: null,
        링크: [],
      },
      자기소개_요약: null,
    });

    const params = Promise.resolve({ versionId: "v1" });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <ResumeDetailPage params={params} />
        </Suspense>,
      );
    });

    await screen.findByText("기록된 경험이 아직 없어요");
    expect(
      screen.getByText("경력 기간을 해석하지 못했어요"),
    ).toBeInTheDocument();
    // 읽기 전용에는 편집기가 없다 — 편집을 약속하는 버튼을 두면 안 된다.
    expect(
      screen.queryByRole("button", { name: "빈 레쥬메 편집하기" }),
    ).not.toBeInTheDocument();
  });

  it("국문은 빈 레쥬메라도 편집으로 들어갈 수 있다", async () => {
    // 위 갈래를 막느라 국문의 탈출구까지 닫으면 안 된다.
    mockGetResume.mockResolvedValue({
      ...resumeFixture(),
      인적사항: {
        이름: null,
        영문명: null,
        생년월일: null,
        이메일: null,
        전화번호: null,
        주소: null,
        링크: [],
      },
      자기소개_요약: null,
    });

    const params = Promise.resolve({ versionId: "v1" });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <ResumeDetailPage params={params} />
        </Suspense>,
      );
    });

    await screen.findByText("기록된 경험이 아직 없어요");
    expect(
      screen.getByRole("button", { name: "빈 레쥬메 편집하기" }),
    ).toBeInTheDocument();
  });
});
