import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

// 데모 분기가 켜지면 실제 계약 파싱을 우회해 이 테스트가 아무것도 검증하지 않게 된다.
vi.mock("@/lib/demo/state", () => ({ isDemoMode: () => false }));

import { api, ApiError } from "./client";
import {
  createCoverLetter,
  CoverLetterMutationUnsupportedError,
  CoverLetterNotReadyError,
  deleteCoverLetter,
  getCoverLetter,
  getCoverLetterList,
  updateCoverLetter,
} from "./cover-letter-api";
import type { CoverLetterResult } from "@/types/cover-letter";

const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);
const mockPatch = vi.mocked(api.patch);
const mockDelete = vi.mocked(api.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

const answer = {
  question: "지원 동기를 서술하시오",
  cover_letter: "저는 학부 시절 데이터 분석 동아리에서…",
  grounding: { grounded: true, unsupported_claims: [], notes: "통과 (교정 반복 0회)" },
  writing_guide: "전략: 두괄식으로…",
};

function ok(data: unknown) {
  return { status: "success", message: "ok", data };
}

// ─── 서버 경로 ──────────────────────────────────────────────────────
//
// 서버 경로는 **언더스코어**(`/export/cover_letter`)다. 화면 URL 이 하이픈
// (`/export/cover-letter/[id]`)이라 API 경로까지 하이픈으로 맞춰 뒀던 적이 있는데, 서버에는
// 그 경로가 없어 생성·조회·목록이 전부 404 였다. 플래그가 꺼져 있어 사용자에게 새지는
// 않았지만 켜는 순간 기능 전체가 죽는다 — 하이픈으로 되돌아가지 못하게 여기서 고정한다.
describe("서버 경로", () => {
  it("생성·목록은 /export/cover_letter 로 간다", async () => {
    mockPost.mockResolvedValue(ok({ id: "cl-1" }));
    mockGet.mockResolvedValue(ok({ contents: [] }));

    await createCoverLetter({ questions: [] });
    await getCoverLetterList();

    expect(mockPost.mock.calls[0][0]).toBe("/export/cover_letter");
    expect(mockGet.mock.calls[0][0]).toBe("/export/cover_letter");
  });

  it("상세·수정·삭제는 /export/cover_letter/{id} 로 간다", async () => {
    mockGet.mockResolvedValue(ok({ answers: [answer] }));
    mockPatch.mockResolvedValue(ok({ answers: [answer] }));
    mockDelete.mockResolvedValue(undefined as never);

    await getCoverLetter("cl-1");
    await updateCoverLetter("cl-1", { answers: [answer] } as CoverLetterResult);
    await deleteCoverLetter("cl-1");

    expect(mockGet.mock.calls[0][0]).toBe("/export/cover_letter/cl-1");
    expect(mockPatch.mock.calls[0][0]).toBe("/export/cover_letter/cl-1");
    expect(mockDelete.mock.calls[0][0]).toBe("/export/cover_letter/cl-1");
  });
});

// ─── createCoverLetter ──────────────────────────────────────────────

describe("createCoverLetter", () => {
  it("문항을 명세 형태로 보낸다 — 제한 있으면 객체, 없으면 문자열", async () => {
    mockPost.mockResolvedValue(ok({ id: "cl-1" }));

    await createCoverLetter({
      questions: [
        { question: "지원 동기", maxChars: 800 },
        { question: "성장 과정" },
      ],
    });

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.questions).toEqual([
      { question: "지원 동기", max_chars: 800 },
      "성장 과정",
    ]);
  });

  it("빈 지원 컨텍스트는 키 자체를 보내지 않는다(백엔드 기본값 보존)", async () => {
    mockPost.mockResolvedValue(ok({ id: "cl-1" }));

    await createCoverLetter({
      questions: [{ question: "지원 동기" }],
      targetCompany: "   ",
      targetJob: "",
      motivation: undefined,
    });

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("target_company");
    expect(body).not.toHaveProperty("target_job");
    expect(body).not.toHaveProperty("motivation");
  });

  it("입력한 지원 컨텍스트는 snake_case 로 실어 보낸다", async () => {
    mockPost.mockResolvedValue(ok({ id: "cl-1" }));

    await createCoverLetter({
      questions: [{ question: "지원 동기" }],
      targetCompany: " 토스 ",
      targetJob: "데이터 분석",
      careerGoal: "포부",
      extraNotes: "메모",
      region: "KR",
      includeWritingGuide: false,
    });

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.target_company).toBe("토스");
    expect(body.target_job).toBe("데이터 분석");
    expect(body.career_goal).toBe("포부");
    expect(body.extra_notes).toBe("메모");
    expect(body.region).toBe("KR");
    expect(body.include_writing_guide).toBe(false);
  });

  it("id 가 없는(계약 미이행) 응답이면 null 로 폴백한다", async () => {
    mockPost.mockResolvedValue(ok({ message: "queued" }));
    await expect(createCoverLetter({ questions: [] })).resolves.toEqual({
      id: null,
      title: undefined,
    });
  });
});

// ─── getCoverLetter ─────────────────────────────────────────────────

describe("getCoverLetter", () => {
  it("data.result 한 겹을 벗기고 래퍼의 id·created_at 을 보존한다", async () => {
    mockGet.mockResolvedValue(
      ok({
        id: "cl-1",
        created_at: "2026-07-24T00:00:00.000Z",
        status: "success",
        result: { answers: [answer], company_research: "미션 요약", meta: { all_grounded: true } },
      }),
    );

    const res = await getCoverLetter("cl-1");
    expect(res.answers).toHaveLength(1);
    expect(res.answers[0].cover_letter).toContain("데이터 분석 동아리");
    expect(res.version_id).toBe("cl-1");
    expect(res.created_at).toBe("2026-07-24T00:00:00.000Z");
    expect(res.company_research).toBe("미션 요약");
  });

  it("result 없이 평탄화된 본문도 받는다(dual-compat)", async () => {
    mockGet.mockResolvedValue(ok({ answers: [answer] }));
    await expect(getCoverLetter("cl-1")).resolves.toMatchObject({
      answers: [expect.objectContaining({ question: "지원 동기를 서술하시오" })],
    });
  });

  // 생성 중/실패한 자소서를 "문항 0개인 성공"으로 보여주면 안 된다.
  it.each([
    ["result:null (생성 중·실패)", { id: "cl-1", result: null }],
    ["result:[] 센티넬", { id: "cl-1", result: [] }],
    ["answers 없는 껍데기", { id: "cl-1", result: { meta: {} } }],
  ])("%s 이면 NotReady 로 던진다", async (_label, data) => {
    mockGet.mockResolvedValue(ok(data));
    await expect(getCoverLetter("cl-1")).rejects.toBeInstanceOf(CoverLetterNotReadyError);
  });

  // "아직 만드는 중"과 "통신이 끊김"은 사용자에게 할 말이 다르다. 소거법으로 판정하면
  // 네트워크 장애가 "곧 완료돼요"로 보여 사용자가 기다리기만 하게 된다.
  it("통신·서버 오류는 NotReady 가 아니다", async () => {
    mockGet.mockRejectedValue(new ApiError(500, "boom"));
    await expect(getCoverLetter("cl-1")).rejects.not.toBeInstanceOf(
      CoverLetterNotReadyError,
    );
  });
});

// ─── getCoverLetterList ─────────────────────────────────────────────

describe("getCoverLetterList", () => {
  it("{ count, contents } 래퍼를 목록으로 파싱하고 status 를 매핑한다", async () => {
    mockGet.mockResolvedValue(
      ok({
        count: 2,
        contents: [
          { id: "cl-1", created_at: "2026-07-24T00:00:00.000Z", status: "success" },
          { id: "cl-2", created_at: "2026-07-23T00:00:00.000Z", status: "queued" },
        ],
      }),
    );

    const items = await getCoverLetterList();
    expect(items.map((i) => i.status)).toEqual(["completed", "processing"]);
    // updated_at 부재 시 created_at 으로 폴백
    expect(items[0].updated_at).toBe("2026-07-24T00:00:00.000Z");
  });

  it("알 수 없는/부재 status 는 undefined 로 둔다(배지 미표시가 유효 상태)", async () => {
    mockGet.mockResolvedValue(ok({ contents: [{ id: "cl-1", created_at: "" }] }));
    const items = await getCoverLetterList();
    expect(items[0].status).toBeUndefined();
  });

  it("id 없는 행은 버린다", async () => {
    mockGet.mockResolvedValue(ok({ contents: [{ created_at: "x" }, { id: "cl-1" }] }));
    await expect(getCoverLetterList()).resolves.toHaveLength(1);
  });
});

// ─── updateCoverLetter (저장 폴백) ──────────────────────────────────

describe("updateCoverLetter", () => {
  const draft = { answers: [answer] } as unknown as CoverLetterResult;

  it.each([405, 501, 422])(
    "%i 이면 UnsupportedError 로 바꿔 호출부가 로컬 draft 로 폴백하게 한다",
    async (status) => {
      mockPatch.mockRejectedValue(new ApiError(status, "nope"));
      await expect(updateCoverLetter("cl-1", draft)).rejects.toBeInstanceOf(
        CoverLetterMutationUnsupportedError,
      );
    },
  );

  // 상태코드만 다른 같은 실패 — 여기서 일반 에러로 흘리면 편집이 통째로 사라진다(FRT-148).
  it("2xx 인데 본문(answers)이 없으면 저장 안 된 것으로 보고 폴백시킨다", async () => {
    mockPatch.mockResolvedValue(ok({ id: "cl-1", title: "제목만" }));
    await expect(updateCoverLetter("cl-1", draft)).rejects.toBeInstanceOf(
      CoverLetterMutationUnsupportedError,
    );
  });

  it("본문이 돌아오면 정규화해서 반환한다", async () => {
    mockPatch.mockResolvedValue(ok({ id: "cl-1", result: { answers: [answer] } }));
    await expect(updateCoverLetter("cl-1", draft)).resolves.toMatchObject({
      answers: [expect.objectContaining({ cover_letter: answer.cover_letter })],
    });
  });

  it("500 같은 진짜 서버 오류는 삼키지 않는다", async () => {
    mockPatch.mockRejectedValue(new ApiError(500, "boom"));
    await expect(updateCoverLetter("cl-1", draft)).rejects.toBeInstanceOf(ApiError);
  });
});

// ─── deleteCoverLetter ──────────────────────────────────────────────

describe("deleteCoverLetter", () => {
  it.each([405, 501])("%i 는 미지원으로 폴백한다", async (status) => {
    mockDelete.mockRejectedValue(new ApiError(status, "nope"));
    await expect(deleteCoverLetter("cl-1")).rejects.toBeInstanceOf(
      CoverLetterMutationUnsupportedError,
    );
  });

  // 저장과 판정을 공유하면 멀쩡한 삭제 버튼이 "곧 제공될 예정"으로 숨는다(FRT-111 교훈).
  it("422 는 미지원으로 보지 않는다 — 삭제는 body 가 없어 422 가 날 이유가 없다", async () => {
    mockDelete.mockRejectedValue(new ApiError(422, "nope"));
    await expect(deleteCoverLetter("cl-1")).rejects.not.toBeInstanceOf(
      CoverLetterMutationUnsupportedError,
    );
  });
});
