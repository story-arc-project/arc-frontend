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
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ResumeDetailPage params={params} />
      </Suspense>,
    );
  });
  await screen.findByLabelText("이름");
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
    expect(captured("resume_edited")[0][1]).toEqual({
      section: "personal_info",
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

  it("고친 게 없으면 저장 버튼이 잠겨 있어 발화하지 않는다", async () => {
    await renderLoaded();

    expect(
      (screen.getByRole("button", { name: "저장" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(captured("resume_edit_saved")).toEqual([]);
  });
});
