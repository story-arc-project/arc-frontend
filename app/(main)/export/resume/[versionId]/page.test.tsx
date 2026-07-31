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

// ResumeMutationUnsupportedError 는 **실물**이어야 한다 — 페이지가 instanceof 로 갈래를
// 가르므로 가짜 클래스를 끼우면 저장 실패가 전부 "그 외 오류"로 흘러 테스트가 거짓이 된다.
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

import { ResumeMutationUnsupportedError } from "@/lib/api/export-api";
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

  // 이 갈래가 지금 실제로 도는 경로다(FRT-111 계약 진행 중). 사용자에게는
  // "곧 제공될 예정이에요"가 뜨고 서버엔 아무것도 안 남는다 — outcome 없이 뭉치면
  // 관리자가 보는 '저장 건수'가 통째로 거짓이 된다.
  it("백엔드가 아직 저장을 못 받으면 outcome='unsupported'", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockRejectedValue(new ResumeMutationUnsupportedError(501));
    await renderLoaded();

    await user.type(screen.getByLabelText("이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith("resume_edit_saved", {
        outcome: "unsupported",
        persisted: true,
        sections: ["personal_info"],
        section_count: 1,
      }),
    );
  });

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

  // 서버도 로컬도 못 남긴 = **편집 유실**. outcome 만으로는 이 최악의 경우가 안 보인다.
  it("임시저장까지 실패하면 draft_saved=false 로 유실을 드러낸다", async () => {
    const user = userEvent.setup();
    mockUpdateResume.mockRejectedValue(new ResumeMutationUnsupportedError(501));
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
            outcome: "unsupported",
            persisted: false,
          }),
        ),
      );
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
      rejectSave(new ResumeMutationUnsupportedError(501));
    });

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith("resume_edit_saved", {
        outcome: "unsupported",
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
