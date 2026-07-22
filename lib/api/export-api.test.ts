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

import { api } from "./client";
import { createResume, getResume, getResumeList, updateResume } from "./export-api";
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
      { language: "ko" },
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
      { language: "ko", title: "내 이력서" },
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
      { language: "ko", experience_ids: ["exp-1", "exp-2"] },
      undefined,
    );
  });

  // 미지정은 "빈 배열"이 아니라 **키 자체의 부재**여야 한다. 서버 계약상 experience_ids 부재는
  // 현행 동작(전체 경험)이고 빈 배열은 400 이므로, 여기서 [] 로 뭉개면 플래그 off 상태에서
  // 레쥬메 생성이 통째로 실패한다.
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

    await expect(getResume("res-3")).rejects.toBeInstanceOf(Error);
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

    await expect(getResume("res-4")).rejects.toBeInstanceOf(Error);
  });
});

// 백엔드(ai_analyst/src/ai/resume.py `_SYS_KO`)는 인적사항.링크를 문자열 배열로 낸다.
// 프런트 내부 shape 은 { label, url } 이라, 정규화가 없으면 PreviewPersonalInfo 의
// `l?.url?.trim()` 필터에 전부 걸려 링크가 화면에서 조용히 사라진다.
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
