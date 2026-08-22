import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

/**
 * 임시 저장이 **아무 계층에도** 못 담기는 상태(`null`)를 주입하는 훅.
 *
 * 계층 폴백이 생긴 뒤로(FRT-261) 메모리 계층이 거의 항상 받아내므로, 브라우저 환경에서
 * `null` 을 실제로 만들 방법이 사실상 없다. 그래도 그 분기는 코드에 살아 있고 "담지 못했으면
 * 이탈이 아니다"라는 불변식이 걸려 있어, 주입으로만 지킬 수 있다.
 */
const draftWrite = vi.hoisted(() => ({ forceFailure: false }));

vi.mock("./_components/resume-draft", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./_components/resume-draft")>();
  return {
    ...actual,
    writeDraft: (...args: Parameters<typeof actual.writeDraft>) =>
      draftWrite.forceFailure ? null : actual.writeDraft(...args),
  };
});

import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { ResumeNotReadyError } from "@/lib/api/export-api";
import { writeDraft } from "./_components/resume-draft";
import { __resetMemoryDrafts } from "@/lib/export/draft-storage";
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
  // clearAllMocks 는 mockReturnValueOnce 큐를 비우지 않는다 — 경합 테스트가 남긴 큐가
  // 다음 테스트로 새면 "왜 이 응답이 오지"를 한참 쫓게 된다.
  mockGetResume.mockReset();
  window.localStorage.clear();
  // draft 는 이제 아래 계층으로도 떨어진다(FRT-261) — 셋 다 비워야 테스트가 격리된다.
  window.sessionStorage.clear();
  __resetMemoryDrafts();
  draftWrite.forceFailure = false;
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
          storage_tier: "local",
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

  // 서버도 웹 스토리지도 못 남긴 상태. 예전에는 그대로 **편집 유실**이었지만 이제 메모리
  // 계층이 받아낸다(FRT-261) — 편집은 살아 있되 새로고침이면 잃는다. outcome 만으로는 그
  // 차이가 안 보이므로 어느 계층에 담겼는지를 함께 남긴다.
  it("웹 스토리지가 다 막히면 storage_tier='memory' 로 위태로움을 드러낸다", async () => {
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
            persisted: true,
            storage_tier: "memory",
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
      // 위기 신호도 함께다. 편집은 메모리 계층이 받아냈지만(FRT-261) 새로고침이면 잃는다.
      expect(message).toContain("새로고침");
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
        storage_tier: "local",
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
            storage_tier: "local",
            sections: ["personal_info"],
            section_count: 1,
          },
        ],
      ]);
    });

    // 웹 스토리지가 다 막혀도 메모리 계층이 받아낸다(FRT-261). 담긴 이상 붙잡지 않는다 —
    // 이 환경에서는 아무리 다시 눌러도 영구 저장이 성공하지 않아, 막으면 출구가 없다.
    // 대신 무엇을 조심해야 하는지(새로고침) 알린 뒤 보낸다.
    it("웹 스토리지가 막히면 경고하고, 이동은 막지 않는다", async () => {
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

      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("새로고침"));
      expect(captured("resume_edit_saved")).toEqual([
        [
          "resume_edit_saved",
          {
            outcome: "exit_draft",
            persisted: true,
            storage_tier: "memory",
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
            storage_tier: "local",
            sections: ["personal_info"],
            section_count: 1,
          },
        ],
      ]);
    });

    /**
     * FRT-261 — '나가기' 버튼은 저장 실패를 알렸지만, GNB 링크·브라우저 뒤로가기로 떠나는
     * 경로가 기댈 안전망은 언마운트 cleanup 하나뿐이었다. 그 자리는 결과를 **지표에만**
     * 남기고 사용자에게는 아무 말도 하지 않아, 저장이 위태로워도 사용자는 알 수 없었다.
     */
    it("언마운트 이탈에서 웹 스토리지가 막히면 사용자에게 경고한다", async () => {
      const user = userEvent.setup();
      const { unmount } = await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      vi.mocked(toast.error).mockClear();
      const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("quota");
        });
      try {
        unmount();
      } finally {
        setItem.mockRestore();
      }

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("새로고침"),
      );
    });

    it("언마운트 이탈이 정상 저장되면 아무것도 경고하지 않는다", async () => {
      const user = userEvent.setup();
      const { unmount } = await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      vi.mocked(toast.error).mockClear();
      unmount();

      expect(toast.error).not.toHaveBeenCalled();
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

    // 같은 이유로 **경고 문구**도 한 번뿐이어야 한다. 계측만 접고 toast 를 안 접으면,
    // 저장 공간이 막힌 사용자는 '나가기' 한 번에 같은 경고를 두 번 받는다 — 두 번째는
    // 알려줄 새 사실이 없으면서 "또 실패했나" 하는 인상만 남긴다.
    it("나가기가 이미 경고했으면 뒤따르는 언마운트는 같은 경고를 되풀이하지 않는다", async () => {
      const user = userEvent.setup();
      const { unmount } = await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      vi.mocked(toast.error).mockClear();
      // 클릭과 뒤이은 언마운트가 **같은** 저장 실패 환경을 만나야 재현된다.
      const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("quota");
        });
      try {
        await user.click(
          screen.getByRole("button", { name: "익스포트로 돌아가기" }),
        );
        await waitFor(() => expect(mockPush).toHaveBeenCalled());
        unmount();
      } finally {
        setItem.mockRestore();
      }

      expect(toast.error).toHaveBeenCalledTimes(1);
    });

    // 실패한 '나가기'는 이탈이 아니다 — 사용자는 화면에 그대로 남는다. 여기서 중복
    // 방지 플래그를 세워버리면, 뒤이어 진짜로 떠날 때 보관된 편집이 통째로 안 남는다.
    it("나가기가 임시 저장에 실패했다면 뒤이은 이탈은 다시 남긴다", async () => {
      const user = userEvent.setup();
      const { unmount } = await renderLoaded();

      await user.type(screen.getByLabelText("이름"), "!");
      // 메모리 계층까지 못 담는 상태를 주입한다 — 이 분기에서만 이동이 막힌다.
      draftWrite.forceFailure = true;
      await user.click(
        screen.getByRole("button", { name: "익스포트로 돌아가기" }),
      );
      expect(mockPush).not.toHaveBeenCalled();

      draftWrite.forceFailure = false;
      unmount();

      expect(captured("resume_edit_saved")).toEqual([
        [
          "resume_edit_saved",
          {
            outcome: "exit_draft",
            persisted: false,
            storage_tier: null,
            sections: ["personal_info"],
            section_count: 1,
          },
        ],
        [
          "resume_edit_saved",
          {
            outcome: "exit_draft",
            persisted: true,
            storage_tier: "local",
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

/**
 * FRT-238 — 버전을 빠르게 갈아탈 때 늦게 도착한 이전 요청의 응답.
 *
 * App Router 는 versionId 만 바뀌면 같은 컴포넌트 인스턴스를 재사용한다. 그래서 A 의 조회가
 * 아직 날아다니는 채로 B 의 조회가 시작될 수 있고, A 가 뒤늦게 도착하면 B 화면이 A 의
 * 내용으로 바뀐다 — 그 상태로 저장하면 **B 의 id 로 A 의 본문이 서버에 실린다.**
 *
 * 응답 순서는 코드 순서가 아니라 resolve 를 부르는 순서로 뒤집는다.
 */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * 조회를 versionId 별로 붙잡아 둔다. 같은 id 로 두 번 부르면 **각각 다른** 응답을 쥔다 —
 * "돌아왔을 때 캐시가 번쩍이는가"를 보려면 두 번째 방문이 따로 기다려야 하기 때문이다.
 */
function routeByVersion() {
  const calls = new Map<string, Deferred<ResumeVersion>[]>();
  mockGetResume.mockReset();
  mockGetResume.mockImplementation((versionId: string) => {
    const d = deferred<ResumeVersion>();
    const list = calls.get(versionId) ?? [];
    list.push(d);
    calls.set(versionId, list);
    return d.promise;
  });
  const at = (versionId: string, nth: number) => {
    const list = calls.get(versionId);
    if (!list?.[nth]) {
      throw new Error(
        `${versionId} 의 ${nth}번째 조회가 아직 없다 (실제 ${list?.length ?? 0}회)`,
      );
    }
    return list[nth];
  };
  return {
    resolve: (versionId: string, data: ResumeVersion, nth = 0) =>
      at(versionId, nth).resolve(data),
    reject: (versionId: string, reason: unknown, nth = 0) =>
      at(versionId, nth).reject(reason),
  };
}

function paramsFor(versionId: string) {
  return Promise.resolve({ versionId });
}

/** 로드 완료를 기다리지 않는다 — 진행 중인 상태 자체가 검증 대상이다. */
async function renderVersion(versionId: string) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={null}>
        <ResumeDetailPage params={paramsFor(versionId)} />
      </Suspense>,
    );
  });
  return result;
}

/**
 * key 를 바꾸지 않는 rerender 여야 한다. key 를 갈면 언마운트-재마운트라
 * "같은 인스턴스가 재사용된다"는 이 버그의 전제 자체가 사라진다.
 */
async function navigateTo(
  result: ReturnType<typeof render>,
  versionId: string,
) {
  await act(async () => {
    result.rerender(
      <Suspense fallback={null}>
        <ResumeDetailPage params={paramsFor(versionId)} />
      </Suspense>,
    );
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function named(
  name: string,
  overrides: Partial<ResumeVersion> = {},
): ResumeVersion {
  return resumeFixture({
    인적사항: {
      이름: name,
      영문명: null,
      생년월일: null,
      이메일: null,
      전화번호: null,
      주소: null,
      링크: [],
    },
    ...overrides,
  });
}

/** 지금 화면에 실린 레쥬메가 누구 것인지 — 편집기가 없으면 null. */
function shownName(): string | null {
  const input = screen.queryByLabelText("이름");
  return input ? (input as HTMLInputElement).value : null;
}

function loadingShown(): boolean {
  return document.querySelector('[aria-busy="true"]') !== null;
}

describe("FRT-238 — 버전 전환 중 늦게 도착한 응답", () => {
  it("A→B 로 옮긴 뒤 늦게 도착한 A 응답이 B 화면을 덮지 않는다", async () => {
    const route = routeByVersion();
    const result = await renderVersion("A");
    await navigateTo(result, "B");

    route.resolve("B", named("B유저"));
    await flush();
    expect(shownName()).toBe("B유저");

    route.resolve("A", named("A유저"));
    await flush();
    expect(shownName()).toBe("B유저");
  });

  it("B 를 기다리는 동안 늦은 A 응답이 로딩을 꺼버리지 않는다", async () => {
    const route = routeByVersion();
    const result = await renderVersion("A");
    await navigateTo(result, "B");

    route.resolve("A", named("A유저"));
    await flush();

    expect(shownName()).toBeNull();
    expect(loadingShown()).toBe(true);
  });

  it("늦게 도착한 A 의 실패가 B 화면을 에러로 바꾸지 않는다", async () => {
    const route = routeByVersion();
    const result = await renderVersion("A");
    await navigateTo(result, "B");

    route.resolve("B", named("B유저"));
    await flush();

    route.reject("A", new Error("late failure"));
    await flush();

    expect(screen.queryByText("레쥬메를 불러오지 못했어요")).toBeNull();
    expect(shownName()).toBe("B유저");
  });

  it("A→B→A 로 되돌아오면 캐시된 옛 내용이 아니라 로딩을 보여준다", async () => {
    const route = routeByVersion();
    const result = await renderVersion("A");
    route.resolve("A", named("A유저"));
    await flush();
    expect(shownName()).toBe("A유저");

    await navigateTo(result, "B");
    await navigateTo(result, "A");

    expect(loadingShown()).toBe(true);
    expect(shownName()).toBeNull();
  });

  it("늦게 도착한 A 응답은 A 의 임시저장을 지우지 않는다", async () => {
    // 서버 본문이 draft 보다 새로우므로, 가드가 없으면 이 응답이 draft 를 지운다.
    // localStorage 삭제는 되돌릴 수 없다 — 여기서 새면 사용자가 쓰던 초안이 사라진다.
    writeDraft("A", resumeFixture());
    const serverNewerThanDraft = named("A유저", {
      meta: {
        language: "ko",
        format: "json",
        generated_at: "2099-01-01T00:00:00Z",
        source_chars: 100,
      },
    });

    const route = routeByVersion();
    const result = await renderVersion("A");
    await navigateTo(result, "B");
    route.resolve("B", named("B유저"));
    await flush();

    route.resolve("A", serverNewerThanDraft);
    await flush();

    expect(window.localStorage.getItem("arc:resume-draft:A")).not.toBeNull();
  });

  it("에러 화면의 '다시 시도'는 지금 보고 있는 버전으로 다시 읽는다", async () => {
    mockGetResume.mockReset();
    mockGetResume
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(named("재시도됨"));

    await renderVersion("B");
    await screen.findByText("레쥬메를 불러오지 못했어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByLabelText("이름")).toHaveValue("재시도됨");
    expect(mockGetResume).toHaveBeenCalledTimes(2);
    expect(mockGetResume).toHaveBeenLastCalledWith("B");
  });

  it("실패 후 다시 시도가 성공하면 에러 화면이 사라진다", async () => {
    mockGetResume.mockReset();
    mockGetResume
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(named("복구됨"));

    await renderVersion("A");
    await screen.findByText("레쥬메를 불러오지 못했어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByLabelText("이름")).toHaveValue("복구됨");
    expect(screen.queryByText("레쥬메를 불러오지 못했어요")).toBeNull();
  });

  it("'다시 시도'를 누른 직후에는 옛 실패 화면이 아니라 로딩을 보여준다", async () => {
    const pending: Deferred<ResumeVersion>[] = [];
    mockGetResume.mockReset();
    mockGetResume.mockImplementationOnce(() =>
      Promise.reject(new Error("boom")),
    );
    mockGetResume.mockImplementation(() => {
      const d = deferred<ResumeVersion>();
      pending.push(d);
      return d.promise;
    });

    await renderVersion("A");
    await screen.findByText("레쥬메를 불러오지 못했어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    // 재조회를 시작한 순간 화면은 지난 실패가 아니라 지금 기다리는 중임을 보여야 한다.
    expect(loadingShown()).toBe(true);
    expect(screen.queryByText("레쥬메를 불러오지 못했어요")).toBeNull();
    expect(pending).toHaveLength(1);
  });

  it("재시도 응답이 늦어 그 사이 다른 버전으로 옮기면, 늦은 응답이 새 버전을 덮지 않는다", async () => {
    const pending: Deferred<ResumeVersion>[] = [];
    mockGetResume.mockReset();
    mockGetResume.mockImplementationOnce(() =>
      Promise.reject(new Error("boom")),
    );
    mockGetResume.mockImplementation(() => {
      const d = deferred<ResumeVersion>();
      pending.push(d);
      return d.promise;
    });

    const result = await renderVersion("A");
    await screen.findByText("레쥬메를 불러오지 못했어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    await navigateTo(result, "B");

    // pending[0] = A 의 재시도, pending[1] = B 의 첫 조회
    pending[1].resolve(named("B유저"));
    await flush();
    expect(shownName()).toBe("B유저");

    pending[0].resolve(named("A유저"));
    await flush();
    expect(shownName()).toBe("B유저");
  });

  it("전환 중 Ctrl+S 를 눌러도 옛 버전 내용이 새 버전 id 로 저장되지 않는다", async () => {
    // 읽기 경로는 가드가 닫았지만 **쓰기 경로**는 별개다. versionId 는 prop 이라 즉시
    // 바뀌는 반면 resume/dirty 는 새 응답이 올 때까지 옛 버전 것이다. 저장 버튼은 이 창에
    // 렌더되지 않지만 전역 Ctrl/Cmd+S 리스너는 살아 있어, 가드가 없으면 그 한 번의 키가
    // **A 의 내용을 B 의 id 로** 서버에 덮어쓴다 — 이 PR 이 막으려던 바로 그 사고다.
    const route = routeByVersion();
    const result = await renderVersion("A");
    route.resolve("A", named("A유저"));
    await flush();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("이름"), "!");
    expect(shownName()).toBe("A유저!");

    await navigateTo(result, "B");
    expect(loadingShown()).toBe(true);

    await act(async () => {
      fireEvent.keyDown(window, { key: "s", metaKey: true });
    });

    expect(mockUpdateResume).not.toHaveBeenCalled();
  });
});

/**
 * FRT-191 — 저장에 **성공**해도 남던 복원 배너.
 *
 * 실패 갈래에는 "배너 하나가 편집을 두 번 잃게 만든다"는 이유까지 달린 `setPendingDraft(null)`
 * 이 있는데 성공 갈래에만 빠져 있었다. 배너가 남으면 '복원'이 방금 서버에 저장한 내용을 지난
 * 세션의 낡은 스냅샷으로 덮고, `clearDraft` 까지 불러 되돌릴 길도 없앤다.
 */
describe("FRT-191 — 저장 성공 후 남는 복원 배너", () => {
  const OLD_DRAFT_SUMMARY = "지난 세션에 고친 문장";

  function seedOlderDraft() {
    window.localStorage.setItem(
      "arc:resume-draft:v1",
      JSON.stringify({
        data: resumeFixture({ 자기소개_요약: OLD_DRAFT_SUMMARY }),
        // meta.generated_at(2026-07-21) 보다 뒤여야 복원 배너가 뜬다.
        updated_at: "2026-07-22T00:00:00Z",
      }),
    );
  }

  function storedDraft(): { data: ResumeVersion } | null {
    const raw = window.localStorage.getItem("arc:resume-draft:v1");
    return raw ? (JSON.parse(raw) as { data: ResumeVersion }) : null;
  }

  it("저장에 성공하면 복원 배너가 사라진다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockImplementation(async (_id, data) => data);
    seedOlderDraft();
    await renderLoaded();

    // 배너가 실재하는 상태에서 출발했음을 먼저 못박는다 — 이게 없으면 "원래 안 떴다"와
    // "저장이 지웠다"가 구별되지 않아 단언이 공허하게 통과한다.
    expect(screen.getByRole("button", { name: "복원" })).toBeTruthy();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "복원" })).toBeNull(),
    );
  });

  it("저장에 성공하면 옛 임시저장은 저장소에도 남지 않는다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockImplementation(async (_id, data) => data);
    seedOlderDraft();
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(storedDraft()).toBeNull();
  });

  // 배너를 지우는 것만으로는 부족하다. 저장이 도는 동안 이어 고쳐도 **낡은 draft 가 저장소에
  // 남으면 안 된다** — 그 뒤 탭을 그냥 닫으면(cleanup 미실행) 다음 진입 때 그 옛 draft 가
  // 다시 배너로 떠 같은 되돌림 사고가 재현된다. 이어 고친 편집은 화면과 dirty 에 살아 있어
  // 이탈 경로들이 남기므로, 여기서 draft 를 새로 만들지 않는다.
  it("저장 중에 이어 고쳐도 옛 draft 는 저장소에 남지 않는다", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: ResumeVersion) => void;
    mockUpdateResume.mockImplementation(
      () =>
        new Promise<ResumeVersion>((resolve) => {
          resolveSave = resolve;
        }),
    );
    seedOlderDraft();
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    // 요청이 도는 동안 이어서 고친다 — 서버가 받아간 스냅샷에는 이 편집이 없다.
    await user.click(screen.getByRole("button", { name: /자기소개/ }));
    await user.type(
      screen.getByPlaceholderText("간단한 자기소개를 적어주세요."),
      "x",
    );

    await act(async () => {
      resolveSave(resumeFixture({ 인적사항: { ...resumeFixture().인적사항, 이름: "김서윤!" } }));
    });

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "복원" })).toBeNull(),
    );
    // 지난 세션 문장이 남아 있으면 다음 진입에서 배너로 되살아나 방금 저장한 내용을 되돌린다.
    expect(storedDraft()).toBeNull();
  });

  function draftName(versionId: string): string | null {
    const raw = window.localStorage.getItem(`arc:resume-draft:${versionId}`);
    if (!raw) return null;
    return (JSON.parse(raw) as { data: ResumeVersion }).data.인적사항.이름;
  }

  // 저장 응답이 도는 동안 다른 버전으로 옮기면, 클로저의 versionId 는 **이전** 버전인데
  // resumeRef 는 이미 **다음** 버전 내용이다(같은 인스턴스를 재사용하므로 — FRT-238).
  // 그 조합으로 임시 저장을 쓰면 남의 본문이 이전 버전의 키에 심겨, 다음 진입 때 배너가
  // 그 본문을 이 버전에 덮어쓴다 — FRT-191 이 막으려던 사고가 더 나쁜 모양으로 돌아온다.
  it("저장 도중 다른 버전으로 옮기면 그 버전 내용이 이전 버전의 임시 저장에 심기지 않는다", async () => {
    const user = userEvent.setup();
    const route = routeByVersion();
    let resolveSave!: (value: ResumeVersion) => void;
    mockUpdateResume.mockImplementation(
      () =>
        new Promise<ResumeVersion>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const result = await renderVersion("A");
    route.resolve("A", named("에이"));
    await flush();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    // B 로 옮긴다 — 이 전환의 cleanup 이 A 의 편집을 A 의 키에 이미 남긴다.
    await navigateTo(result, "B");
    route.resolve("B", named("비"));
    await flush();

    // 이제서야 A 의 PATCH 응답이 도착한다.
    await act(async () => {
      resolveSave(named("에이!"));
    });
    await flush();

    expect(shownName()).toBe("비");
    // A 의 임시 저장은 전환 시점에 남긴 A 의 편집 그대로여야 한다.
    expect(draftName("A")).toBe("에이!");
  });

  // versionId 만 보는 가드로는 **A→B→A** 왕복이 안 잡힌다. 돌아오면 versionId 는 다시
  // 같아지지만, 그 사이 재조회가 끼어들어 resumeRef 는 **저장 전** 본문으로 되돌아가 있다.
  // 그걸 "이어 고친 편집"으로 오인해 쓰면 전환 때 남긴 올바른 draft 를 낡은 본문으로 덮고
  // 배너까지 지운다 — 복원할 것이 사라진 채로 저장된 편집을 잃는 길이다.
  it("저장 도중 A→B→A 로 돌아와도 재조회한 저장 전 본문이 임시 저장을 덮지 않는다", async () => {
    const user = userEvent.setup();
    const route = routeByVersion();
    let resolveSave!: (value: ResumeVersion) => void;
    mockUpdateResume.mockImplementation(
      () =>
        new Promise<ResumeVersion>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const result = await renderVersion("A");
    route.resolve("A", named("에이"));
    await flush();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    // A→B→A. 떠나던 순간의 cleanup 이 A 의 편집을 A 의 키에 남긴다.
    await navigateTo(result, "B");
    route.resolve("B", named("비"));
    await flush();
    await navigateTo(result, "A");
    // 두 번째 A 조회는 PATCH 가 아직 안 끝나 **저장 전** 본문을 준다.
    route.resolve("A", named("에이"), 1);
    await flush();

    // 이제서야 A 의 PATCH 응답이 도착한다.
    await act(async () => {
      resolveSave(named("에이!"));
    });
    await flush();

    expect(draftName("A")).toBe("에이!");
    // 배너까지 지우면 그 편집으로 되돌아갈 길이 함께 사라진다.
    expect(screen.queryByRole("button", { name: "복원" })).toBeTruthy();
  });

  // 언마운트는 seq 를 올리지 않는다 — 같은 레쥬메로 다시 들어오면 **새 인스턴스**의 키가
  // seq 0 부터 시작해 옛 인스턴스의 키와 겹친다. 그 상태로 늦게 끝난 옛 저장이 가드를
  // 통과하면, 새 인스턴스가 **복원하라고 띄워 둔 임시 저장을 지워버린다** — 배너는 화면에
  // 남아 있는데 되돌릴 내용은 사라진 상태가 된다.
  it("언마운트 뒤 늦게 끝난 저장은 새 인스턴스가 띄운 임시 저장을 지우지 않는다", async () => {
    const user = userEvent.setup();
    const route = routeByVersion();
    let resolveSave!: (value: ResumeVersion) => void;
    mockUpdateResume.mockImplementation(
      () =>
        new Promise<ResumeVersion>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const first = await renderVersion("A");
    route.resolve("A", named("에이"));
    await flush();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    // 완전한 이탈 — 언마운트 cleanup 이 A 의 편집을 A 키에 남긴다.
    first.unmount();

    // 같은 레쥬메로 다시 들어온다(새 인스턴스, seq 는 0 부터).
    await renderVersion("A");
    route.resolve("A", named("에이"), 1);
    await flush();

    // 새 인스턴스는 그 임시 저장을 "복원하시겠어요"로 띄운 상태다.
    expect(screen.getByRole("button", { name: "복원" })).toBeTruthy();
    expect(draftName("A")).toBe("에이!");

    // 이제서야 옛 인스턴스의 저장이 끝난다.
    await act(async () => {
      resolveSave(named("에이!"));
    });
    await flush();

    // 배너가 가리키는 임시 저장이 사라지면 되돌릴 길이 없어진다.
    expect(draftName("A")).toBe("에이!");
  });
});


/**
 * FRT-326 - 생성은 비동기다. 그 사이 상세로 들어오면 서버는 200 에 `result: null` 을 준다.
 *
 * 그 상태를 "불러오지 못했어요"로 그리면 사용자는 **정상 진행을 실패로 읽는다** - 자소서 상세는
 * 이미 갈라 놓았으므로(CoverLetterNotReadyError) 한 화면 안에서 두 기능이 다른 말을 한다.
 *
 * 안내 문구는 자소서를 그대로 베끼지 않는다: 자소서 목록에는 폴링이 있어 "완료되면 목록에서
 * 열 수 있어요"가 참이지만, **레쥬메 목록에는 폴링이 없다**(FRT-325). 지킬 수 없는 약속 대신
 * 이 화면에 실재하는 탈출구('다시 시도')를 가리킨다.
 */
describe("FRT-326 - 아직 만들고 있는 레쥬메", () => {
  it("준비 안 된 레쥬메는 실패가 아니라 '아직 만들고 있어요'로 말한다", async () => {
    const route = routeByVersion();
    await renderVersion("A");
    route.reject("A", new ResumeNotReadyError());
    await flush();

    expect(screen.getByText("아직 만들고 있어요")).toBeTruthy();
    expect(screen.queryByText("레쥬메를 불러오지 못했어요")).toBeNull();
  });

  it("그 화면은 이 자리에서 이을 길('다시 시도')을 가리킨다", async () => {
    const route = routeByVersion();
    await renderVersion("A");
    route.reject("A", new ResumeNotReadyError());
    await flush();

    // 목록은 스스로 갱신되지 않으므로 "목록에서 열 수 있어요"라고 말하면 안 된다.
    expect(screen.getByText(/'다시 시도'를 눌러/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  it("'다시 시도'로 완성된 레쥬메를 그 자리에서 연다", async () => {
    const route = routeByVersion();
    await renderVersion("A");
    route.reject("A", new ResumeNotReadyError());
    await flush();
    await screen.findByText("아직 만들고 있어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    route.resolve("A", named("다 됐다"), 1);
    await flush();

    expect(shownName()).toBe("다 됐다");
    expect(screen.queryByText("아직 만들고 있어요")).toBeNull();
  });

  // 소거법("ApiError 가 아니면 준비 중")으로 판정하면 네트워크 장애·파싱 실패까지
  // "아직 만들고 있어요"가 된다 - 사용자는 고칠 수 있는 것을 못 고친 채 기다린다.
  it("일반 실패는 여전히 '불러오지 못했어요'다", async () => {
    const route = routeByVersion();
    await renderVersion("A");
    route.reject("A", new Error("boom"));
    await flush();

    expect(screen.getByText("레쥬메를 불러오지 못했어요")).toBeTruthy();
    expect(screen.queryByText("아직 만들고 있어요")).toBeNull();
  });

  it("404 는 여전히 '찾을 수 없어요'다 - 준비 중이 그 판정을 가리지 않는다", async () => {
    const route = routeByVersion();
    await renderVersion("A");
    route.reject("A", new ApiError(404, "not found"));
    await flush();

    expect(screen.getByText("레쥬메를 찾을 수 없어요")).toBeTruthy();
    expect(screen.queryByText("아직 만들고 있어요")).toBeNull();
  });
});
