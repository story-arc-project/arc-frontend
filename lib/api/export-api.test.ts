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
import { createResume, getResumeList } from "./export-api";

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
