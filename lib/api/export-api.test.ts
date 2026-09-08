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

vi.mock("@/lib/demo/state", () => ({ isDemoMode: () => false }));

import { api, ApiError } from "./client";
import {
  createResume,
  deleteResume,
  getResume,
  getResumeList,
  ResumeNotReadyError,
  updateResume,
} from "./export-api";
import { isEmptySection } from "@/types/resume";

const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getResumeList", () => {
  it("백엔드 { count, contents } 래퍼를 목록으로 파싱한다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "Fetch success.",
      data: {
        count: 1,
        contents: [
          {
            id: "11111111-2222-3333-4444-555555555555",
            created_at: "2026-07-17T02:30:00.000Z",
            updated_at: "2026-07-17T02:35:00.000Z",
          },
        ],
      },
    });

    const items = await getResumeList();

    expect(items).toEqual([
      {
        version_id: "11111111-2222-3333-4444-555555555555",
        created_at: "2026-07-17T02:30:00.000Z",
        updated_at: "2026-07-17T02:35:00.000Z",
      },
    ]);
  });

  it("빈 목록을 그대로 돌려준다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "Fetch success.",
      data: { count: 0, contents: [] },
    });

    await expect(getResumeList()).resolves.toEqual([]);
  });

  it("래퍼 없이 배열로 와도 파싱한다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: [{ id: "a", created_at: "2026-07-17T02:30:00.000Z", updated_at: "2026-07-17T02:30:00.000Z" }],
    });

    const items = await getResumeList();

    expect(items).toHaveLength(1);
    expect(items[0].version_id).toBe("a");
  });

  it("id 가 없는 항목은 버린다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { count: 2, contents: [{ created_at: "2026-07-17T02:30:00.000Z" }, null] },
    });

    await expect(getResumeList()).resolves.toEqual([]);
  });

  it("updated_at 이 없으면 created_at 으로 채운다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { count: 1, contents: [{ id: "a", created_at: "2026-07-17T02:30:00.000Z" }] },
    });

    const items = await getResumeList();

    expect(items[0].updated_at).toBe("2026-07-17T02:30:00.000Z");
  });

  it("data 형태가 예상 밖이어도 throw 하지 않는다", async () => {
    mockGet.mockResolvedValue({ status: "success", message: "ok", data: "unexpected" });

    await expect(getResumeList()).resolves.toEqual([]);
  });
});

describe("createResume — id 이중경로 (FRT-123 계약 §2.4)", () => {
  it("id 없는 응답(구 백엔드)에도 throw 하지 않고 { id: null } 을 돌려준다", async () => {
    mockPost.mockResolvedValue({
      status: "success",
      message: "Resume generation queued successfully.",
    });

    await expect(createResume({ language: "ko" })).resolves.toEqual({ id: null });
    expect(mockPost).toHaveBeenCalledWith(
      "/export/resume",
      // FRT-207 — 기본 생성은 1쪽 제한이라 두 상수가 항상 함께 나간다.
      { language: "ko", max_pages: 1, auto_fill: true },
      undefined,
    );
  });

  it("data.{id,title} 가 오면 그대로 추출한다 (계약 이행 백엔드)", async () => {
    mockPost.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-1", title: "2026-07-17 resume" },
    });

    await expect(createResume({ language: "en" })).resolves.toEqual({
      id: "res-1",
      title: "2026-07-17 resume",
    });
  });

  it("title 을 넘기면 body 에 실어 보낸다", async () => {
    mockPost.mockResolvedValue({ status: "success", message: "ok", data: { id: "res-2" } });
    await createResume({ language: "ko", title: "내 이력서" });
    expect(mockPost).toHaveBeenCalledWith(
      "/export/resume",
      { language: "ko", title: "내 이력서", max_pages: 1, auto_fill: true },
      undefined,
    );
  });
});

describe("createResume — experience_ids (FRT-109 / BAC-45 계약)", () => {
  it("experienceIds 를 넘기면 snake_case 로 body 에 싣는다", async () => {
    mockPost.mockResolvedValue({ status: "success", message: "ok", data: { id: "res-3" } });

    await createResume({ language: "ko", experienceIds: ["exp-1", "exp-2"] });

    expect(mockPost).toHaveBeenCalledWith(
      "/export/resume",
      // 사용자가 경험을 직접 골랐으면 자동 채움을 끈다 — 켜두면 일부러 뺀 경험이
      // 1쪽 여백을 메우려고 되돌아온다.
      { language: "ko", experience_ids: ["exp-1", "exp-2"], max_pages: 1, auto_fill: false },
      undefined,
    );
  });

  // 미지정은 "빈 배열"이 아니라 **키 자체의 부재**여야 한다. 서버 계약상 experience_ids 부재는
  // 현행 동작(전체 경험)이고 빈 배열은 400 이므로, 여기서 [] 로 뭉개면 플래그 off 상태에서
  // 이력서 생성이 통째로 실패한다.
  it("experienceIds 를 안 넘기면 body 에 키 자체가 없다", async () => {
    mockPost.mockResolvedValue({ status: "success", message: "ok", data: { id: "res-4" } });

    await createResume({ language: "ko" });

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect("experience_ids" in body).toBe(false);
  });

  it("빈 배열을 명시적으로 넘기면 그대로 싣는다(차단은 호출부 책임)", async () => {
    mockPost.mockResolvedValue({ status: "success", message: "ok", data: { id: "res-5" } });

    await createResume({ language: "ko", experienceIds: [] });

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.experience_ids).toEqual([]);
  });
});

describe("getResume — data.result 언랩 (FRT-123 계약 §3.6, dual-compat)", () => {
  const content = {
    meta: { format: "json", version: "1.0" },
    인적사항: { 이름: "홍길동" },
    학력: [],
    경력: [],
  };

  it("본문이 data.result 한 겹에 감싸 오면 벗겨 반환한다 (계약 이행 백엔드)", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "res-1",
        title: "내 이력서",
        language: "ko",
        status: "success",
        created_at: "2026-07-18T00:00:00.000Z",
        updated_at: "2026-07-18T00:00:00.000Z",
        result: content,
      },
    });

    const resume = await getResume("res-1");
    // 래퍼가 아니라 본문(인적사항)이 최상위로 온다.
    // (toMatchObject — normalizeResumeVersion 이 링크를 항상 배열로 보장해 키가 하나 는다)
    expect(resume.인적사항).toMatchObject({ 이름: "홍길동" });
    // 래퍼 id 를 version_id 로 보존한다.
    expect(resume.version_id).toBe("res-1");
  });

  it("result 래퍼 없이 본문이 data 로 평탄화돼 와도 그대로 반환한다 (미래 백엔드 폴백)", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { version_id: "res-2", ...content },
    });

    const resume = await getResume("res-2");
    expect(resume.인적사항).toMatchObject({ 이름: "홍길동" });
    expect(resume.version_id).toBe("res-2");
  });

  it("본문에 version_id 가 이미 있으면 래퍼 id 로 덮어쓰지 않는다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "wrapper-id", result: { version_id: "inner-id", ...content } },
    });

    const resume = await getResume("wrapper-id");
    expect(resume.version_id).toBe("inner-id");
  });

  it("result 부재 + 본문 아님(생성중/실패 래퍼)이면 폴백하지 않고 throw 한다", async () => {
    // result: null 이고 meta(본문 마커)도 없는 미완료 래퍼를 그대로 ResumeVersion 으로
    // 반환하면 상세 페이지가 resume.meta.language 에서 크래시한다. 제어된 에러 상태로 보낸다.
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "res-3",
        title: "생성중",
        language: "ko",
        status: "processing",
        result: null,
      },
    });

    // FRT-326 - 맨 Error 로 던지면 상세 화면이 "아직 만드는 중"과 "못 불러왔다"를 못 가른다.
    await expect(getResume("res-3")).rejects.toBeInstanceOf(ResumeNotReadyError);
  });

  it("result 가 배열 센티넬([])이면 본문으로 오인하지 않고 throw 한다 (codex xhigh)", async () => {
    // result:[] 를 큐잉/플레이스홀더로 쓰는 백엔드가 있으면 배열을 스프레드해 {} 로 뭉개
    // meta 없는 껍데기를 반환 → 상세 페이지가 resume.meta.language 에서 크래시한다.
    // 배열은 본문 레코드가 아니므로 result:null 과 같은 미완료 취급으로 throw 해야 한다.
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "res-4",
        title: "생성중",
        language: "ko",
        status: "processing",
        result: [],
      },
    });

    await expect(getResume("res-4")).rejects.toBeInstanceOf(ResumeNotReadyError);
  });

  // FRT-326 - 자소서(CoverLetterNotReadyError)와 같은 모양으로 갈라 놓는다. 소거법("ApiError 가
  // 아니면 준비 중")으로 판정하면 네트워크 장애·파싱 실패까지 "아직 만들고 있어요"가 되므로,
  // 준비 안 됨은 **전용 타입으로만** 말한다.
  it("아직 준비 안 된 이력서는 ResumeNotReadyError 로 말한다 - 일반 실패와 갈린다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-5", status: "queued", result: null },
    });

    const err = await getResume("res-5").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResumeNotReadyError);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe("ResumeNotReadyError");
    // ApiError 가 아니다 - 상세 화면의 404 분기(status 판정)에 걸리면 안 된다.
    expect(err).not.toBeInstanceOf(ApiError);
  });

  // 래퍼조차 없는 응답(null·원시값·배열)은 "만드는 중"이 아니다. 생성 중이라는 증거는
  // **래퍼가 존재한다는 사실** 자체인데 그것이 없으므로, 재시도로 풀릴 수 없는 형식 오류다.
  // 여기서 "다 만들어지면 다시 시도"를 보여주면 오지 않을 완료를 기다리게 된다(codex P2).
  it("응답 자체가 본문이 아니면(null·원시값·배열) '만드는 중'으로 말하지 않는다", async () => {
    for (const data of [null, "oops", 42, []]) {
      mockGet.mockResolvedValue({ status: "success", message: "ok", data });

      const err = await getResume("res-6").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(ResumeNotReadyError);
    }
  });

  // 본문이 없다고 다 "만드는 중"은 아니다. 래퍼의 status 가 **끝났다**고 말하는데 본문이
  // 없으면 그건 실패다 — "아직 만들고 있어요 / 다 만들어지면 다시 시도" 로 안내하면
  // 영영 오지 않을 완료를 기다리며 재시도만 누르게 된다(codex P2).
  it("status:failed 래퍼는 '만드는 중'이 아니다 - ResumeNotReadyError 로 말하지 않는다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-7", status: "failed", result: null },
    });

    const err = await getResume("res-7").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ResumeNotReadyError);
  });

  it("status:success 인데 본문이 없으면 실패다 - '만드는 중'으로 말하지 않는다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-8", status: "success", result: null },
    });

    const err = await getResume("res-8").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ResumeNotReadyError);
  });

  // 반대쪽 회귀: status 를 안 주거나 모르는 값이면 **끝났다는 증거가 없다.** 여기서 실패로
  // 단정하면 정상 생성 중인 이력서가 다시 "불러오지 못했어요"가 된다(FRT-326 원래 증상).
  it("status 가 없거나 미지 값이면 여전히 ResumeNotReadyError 다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-9", result: null },
    });
    await expect(getResume("res-9")).rejects.toBeInstanceOf(ResumeNotReadyError);

    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-10", status: "weird", result: null },
    });
    await expect(getResume("res-10")).rejects.toBeInstanceOf(ResumeNotReadyError);
  });
});

// 백엔드(ai_analyst/src/ai/resume.py `_SYS_KO`)는 인적사항.링크를 문자열 배열로 낸다.
// 프런트 내부 shape 은 { label, url } 이라, 정규화가 없으면 PreviewPersonalInfo 의
// `l?.url?.trim()` 필터에 전부 걸려 링크가 화면에서 조용히 사라진다.
describe("getResume — 영문 스키마 매핑 (FRT-147)", () => {
  it("영문 응답이 빈 껍데기가 아니라 채워진 본문으로 온다", async () => {
    // 이 경계가 없으면 EN 응답의 최상위 키가 전부 국문 키와 달라 상세 화면이
    // EmptyResumeState("기록된 경험이 아직 없어요")로 빠진다 — 사용자는 크레딧만 쓴다.
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "res-en",
        result: {
          meta: { language: "en", format: "western_resume", generated_at: "2026-07-31", source_chars: 12 },
          contact: { name: "HyunJu Kim", email: "k@example.com", other_links: ["https://hyunju.dev"] },
          summary: "Analyst.",
          work_experience: [{ id: 1, company: "BCG", title: "Analyst", employment_type: "Internship" }],
          skills: { technical: ["Python"], languages: ["English (TOEFL 115)"] },
          publications: [{ id: 1, title: "Urban mobility", venue: "KGS" }],
        },
      },
    });

    const resume = await getResume("res-en");
    expect(resume.인적사항.이름).toBe("HyunJu Kim");
    expect(resume.자기소개_요약).toBe("Analyst.");
    expect(resume.경력[0].회사명).toBe("BCG");
    // 영문 원문을 국문 enum 으로 번역하지 않는다.
    expect(resume.경력[0].고용형태).toBe("Internship");
    expect(resume.어학[0].언어).toBe("English (TOEFL 115)");
    expect(resume.논문?.[0].제목).toBe("Urban mobility");
    // 링크 정규화(기존 경계)도 매핑 뒤에 그대로 걸린다.
    expect(resume.인적사항.링크).toEqual([{ label: null, url: "https://hyunju.dev" }]);
  });

  it("국문 응답은 매핑을 타지 않는다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "res-ko",
        result: {
          meta: { language: "ko", format: "korean_resume" },
          인적사항: { 이름: "김상협", 링크: [] },
          경력: [{ id: 1, 회사명: "ARC", 고용형태: "정규직" }],
        },
      },
    });

    const resume = await getResume("res-ko");
    expect(resume.인적사항.이름).toBe("김상협");
    expect(resume.경력[0].고용형태).toBe("정규직");
  });
});

describe("getResume — 인적사항.링크 정규화 (FRT-109, 백엔드 실값 대조)", () => {
  const base = { meta: { language: "ko", format: "korean_resume" }, 학력: [], 경력: [] };

  it("문자열 배열로 오면 { label: null, url } 로 정규화한다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "res-l1",
        result: { ...base, 인적사항: { 이름: "홍길동", 링크: ["https://github.com/me", "  "] },
        },
      },
    });

    const resume = await getResume("res-l1");
    // 공백뿐인 항목은 링크가 아니다 — 빈 행으로 남기지 않고 버린다.
    expect(resume.인적사항.링크).toEqual([{ label: null, url: "https://github.com/me" }]);
  });

  it("이미 { label, url } 객체로 오면 그대로 통과시킨다 (dual-compat)", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "res-l2",
        result: {
          ...base,
          인적사항: { 이름: "홍길동", 링크: [{ label: "GitHub", url: "https://github.com/me" }] },
        },
      },
    });

    const resume = await getResume("res-l2");
    expect(resume.인적사항.링크).toEqual([{ label: "GitHub", url: "https://github.com/me" }]);
  });

  it("링크 필드가 없거나 배열이 아니어도 빈 배열로 안전하게 만든다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-l3", result: { ...base, 인적사항: { 이름: "홍길동" } } },
    });

    const resume = await getResume("res-l3");
    expect(resume.인적사항.링크).toEqual([]);
  });

  it("updateResume 도 같은 경계를 태운다 — 래퍼를 벗기고 링크를 정규화한다", async () => {
    // PATCH 응답도 GET 과 같은 래퍼다. 래퍼를 그대로 돌려주면 호출부가 본문 대신 래퍼를
    // 상태에 넣어 resume.meta.language 에서 크래시한다(codex 지적).
    const mockPatch = vi.mocked(api.patch);
    mockPatch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "res-u1",
        title: "제목",
        result: { ...base, 인적사항: { 이름: "홍길동", 링크: ["https://a.dev"] } },
      },
    });

    const updated = await updateResume("res-u1", {} as never);
    expect(updated.인적사항.링크).toEqual([{ label: null, url: "https://a.dev" }]);
    expect(updated.version_id).toBe("res-u1");
  });

  // 인적사항이 통째로 빠진 본문도 언랩을 통과한다(그쪽은 meta 만 본다). 그대로 흘려보내면
  // PersonalInfoEditor 가 undefined.이름 에서 던져 편집 화면이 통째로 죽는다.
  it("인적사항 자체가 없으면 빈 인적사항으로 채운다 — 편집기가 undefined 를 만나지 않게", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-l4", result: { ...base } },
    });

    const resume = await getResume("res-l4");
    expect(resume.인적사항.링크).toEqual([]);
    expect(resume.인적사항.이름).toBeNull();
    // 프리뷰는 isEmptySection 으로 그대로 숨기므로 화면에 빈 섹션이 새로 생기지는 않는다.
    expect(isEmptySection(resume.인적사항 as unknown as Record<string, unknown>)).toBe(true);
  });
});

describe("getResumeList — title/language/status 파싱 (FRT-123 계약 §2.4)", () => {
  it("계약 필드가 오면 목록 항목에 싣는다", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        count: 1,
        contents: [
          {
            id: "r1",
            created_at: "2026-07-17T02:30:00.000Z",
            updated_at: "2026-07-17T02:35:00.000Z",
            title: "내 이력서",
            language: "en",
            status: "success",
          },
        ],
      },
    });

    const items = await getResumeList();
    expect(items[0]).toMatchObject({
      version_id: "r1",
      title: "내 이력서",
      language: "en",
      status: "completed", // success → completed
    });
  });

  it("계약 필드 부재 시 title/language/status 는 undefined (구 백엔드 폴백)", async () => {
    mockGet.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { count: 1, contents: [{ id: "r1", created_at: "2026-07-17T02:30:00.000Z" }] },
    });

    const items = await getResumeList();
    expect(items[0].title).toBeUndefined();
    expect(items[0].language).toBeUndefined();
    expect(items[0].status).toBeUndefined();
  });

  it("status 매핑: queued→processing, 이미 프런트형 processing 은 통과, 미지 값은 undefined", async () => {
    const cases: [string, string | undefined][] = [
      ["queued", "processing"],
      ["processing", "processing"],
      ["pending", "pending"],
      ["failed", "failed"],
      ["weird-status", undefined],
    ];
    for (const [input, expected] of cases) {
      mockGet.mockResolvedValue({
        status: "success",
        message: "ok",
        data: { count: 1, contents: [{ id: "r1", created_at: "2026-07-17T02:30:00.000Z", status: input }] },
      });
      const items = await getResumeList();
      expect(items[0].status).toBe(expected);
    }
  });
});

// ─── 저장 요청 본문 계약 ─────────────────────────────────────────────
//
// 서버(BAC-56)의 `ResumePatchRequest` 는 `{title?, result?}` 이고 pydantic 기본이
// extra="ignore" 다. 맨 ResumeVersion 을 보내면 **거절당하지 않는다** — 두 필드 모두
// 미지정으로 처리돼 아무것도 안 바뀐 채 200 과 **옛 본문**이 돌아오고, 언랩이 멀쩡히
// 성공해 호출부는 옛 본문을 확정하고 draft 까지 지운 뒤 "저장됐어요"를 띄운다.
// 실패가 아니라 **성공으로 위장된 유실**이라 상태코드 그물에는 안 걸린다 — 본문 모양을 박는다.
describe("updateResume 요청 본문", () => {
  const mockPatch = vi.mocked(api.patch);

  it("본문을 result 로 감싸 보낸다", async () => {
    mockPatch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-b1", result: { meta: { language: "ko" } } },
    });

    const body = {
      meta: { language: "ko" },
      자기소개_요약: "고친 내용",
    } as unknown as Parameters<typeof updateResume>[1];
    await updateResume("res-b1", body);

    expect(mockPatch).toHaveBeenCalledWith("/export/resume/res-b1", {
      result: body,
    });
  });
});

// ─── 저장·삭제 실패 매핑 ─────────────────────────────────────────────
//
// BAC-56 이 배포되면서 `PATCH`·`DELETE /export/resume/{id}` 가 둘 다 실재한다
// (라이브 probe 401 = 존재). 그래서 **"미구현 폴백"이라는 개념 자체가 사라졌다** —
// 어떤 실패든 있는 그대로 올려야 화면이 사유를 말할 수 있다. 특정 상태코드를 골라
// 삼키면 그만큼 화면이 벙어리가 된다.
describe("resume 뮤테이션 실패 매핑", () => {
  const mockPatch = vi.mocked(api.patch);
  const mockDelete = vi.mocked(api.delete);

  it("updateResume: 422 는 진짜 검증 실패다 — 사유를 그대로 올린다", async () => {
    mockPatch.mockRejectedValue(new ApiError(422, "제목은 100자를 넘을 수 없어요."));

    const err = await updateResume("res-1", {} as never).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toContain("100자");
  });

  // 생성이 아직 안 끝난 이력서를 저장하면 서버가 400 을 준다(`patch_resume` 의 유일한
  // 400 분기). 상태코드를 삼키면 화면이 "왜 안 되는지"를 말할 수 없다.
  it("updateResume: 400(생성 미완료)도 그대로 올린다", async () => {
    mockPatch.mockRejectedValue(new ApiError(400, "Resume is not completed yet."));

    const err = await updateResume("res-1", {} as never).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
  });

  // 405/501 은 배포된 서버에서 나올 수 없다. 그래도 온다면(구 백엔드 롤백) 그건
  // **저장 실패**이지 별도 안내가 필요한 특수 상태가 아니다 — 화면이 실패로 다루면
  // 임시 저장은 그대로 남고 편집도 잃지 않는다.
  it.each([501, 405])(
    "updateResume: %i 도 더는 특별 취급하지 않는다 — ApiError 그대로 올린다",
    async (status) => {
      mockPatch.mockRejectedValue(new ApiError(status, "unsupported"));

      const err = await updateResume("res-1", {} as never).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(status);
    },
  );

  // 배포된 PATCH 는 GET 과 같은 `ResumeData`(result 포함)를 돌려준다. 그런데도 본문이
  // 없다면 응답이 계약을 벗어난 것이므로 **성공으로 위장하지 않는다** — 여기서 조용히
  // 요청 본문을 되돌려주면 "저장됐어요"가 뜨고 임시 저장까지 지워져, 정작 서버엔 아무것도
  // 안 남는 유실이 재현된다.
  it("updateResume: 2xx 인데 result 가 없으면 성공으로 위장하지 않고 실패로 올린다", async () => {
    mockPatch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: "res-1", title: "제목" },
    });

    await expect(updateResume("res-1", {} as never)).rejects.toThrow();
  });

  it("updateResume: 그 밖의 실패는 그대로 올린다", async () => {
    mockPatch.mockRejectedValue(new ApiError(500, "server error"));

    const err = await updateResume("res-1", {} as never).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });

  it("deleteResume: 422 를 삼키지 않는다", async () => {
    mockDelete.mockRejectedValue(new ApiError(422, "Unprocessable Entity"));

    const err = await deleteResume("res-1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
  });

  it.each([501, 405])(
    "deleteResume: %i 도 ApiError 그대로 올린다 — 버튼을 숨기지 않는다",
    async (status) => {
      mockDelete.mockRejectedValue(new ApiError(status, "unsupported"));

      const err = await deleteResume("res-1").catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(status);
    },
  );
});
