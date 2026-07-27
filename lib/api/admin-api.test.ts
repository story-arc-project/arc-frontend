import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
vi.mock("./client", () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
}));

import { getAdminCustomers } from "./admin-api";

function ok(data: unknown) {
  return { status: "success", message: "", data };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAdminCustomers — 쿼리 직렬화", () => {
  it("파라미터 없으면 순수 경로만 요청한다", async () => {
    getMock.mockResolvedValue(ok({ count: 0, contents: [] }));
    await getAdminCustomers();
    expect(getMock).toHaveBeenCalledWith("/admin/customers");
  });

  it("q·limit·offset 을 쿼리스트링으로 붙인다", async () => {
    getMock.mockResolvedValue(ok({ count: 0, contents: [] }));
    await getAdminCustomers({ q: "kim", limit: 20, offset: 40 });
    expect(getMock).toHaveBeenCalledWith(
      "/admin/customers?q=kim&limit=20&offset=40",
    );
  });

  it("빈/공백 검색어는 q 를 생략한다", async () => {
    getMock.mockResolvedValue(ok({ count: 0, contents: [] }));
    await getAdminCustomers({ q: "   ", limit: 20, offset: 0 });
    expect(getMock).toHaveBeenCalledWith("/admin/customers?limit=20&offset=0");
  });

  it("offset 0 은 생략하지 않는다(첫 페이지 명시)", async () => {
    getMock.mockResolvedValue(ok({ count: 0, contents: [] }));
    await getAdminCustomers({ offset: 0 });
    expect(getMock).toHaveBeenCalledWith("/admin/customers?offset=0");
  });

  it("검색어 앞뒤 공백은 다듬어 보낸다", async () => {
    getMock.mockResolvedValue(ok({ count: 0, contents: [] }));
    await getAdminCustomers({ q: "  a@b.com  " });
    expect(getMock).toHaveBeenCalledWith("/admin/customers?q=a%40b.com");
  });
});

describe("getAdminCustomers — 응답 매핑", () => {
  it("snake_case 필드를 camelCase 로 옮긴다", async () => {
    getMock.mockResolvedValue(
      ok({
        count: 1,
        contents: [
          {
            id: "c1",
            email: "a@b.com",
            name: "김철수",
            status: "active",
            onboarded: true,
            created_at: "2026-01-02T03:04:05Z",
          },
        ],
      }),
    );
    const { count, contents } = await getAdminCustomers();
    expect(count).toBe(1);
    expect(contents[0]).toEqual({
      id: "c1",
      email: "a@b.com",
      name: "김철수",
      status: "active",
      onboarded: true,
      createdAt: "2026-01-02T03:04:05Z",
    });
  });

  it("createdAt 은 camelCase 표기도 폴백으로 받는다", async () => {
    getMock.mockResolvedValue(
      ok({ count: 1, contents: [{ id: "c1", createdAt: "2026-05-05" }] }),
    );
    const { contents } = await getAdminCustomers();
    expect(contents[0].createdAt).toBe("2026-05-05");
  });

  it("name 이 없거나 빈 문자열이면 null 로 정규화한다", async () => {
    getMock.mockResolvedValue(
      ok({
        count: 2,
        contents: [{ id: "c1", name: "" }, { id: "c2" }],
      }),
    );
    const { contents } = await getAdminCustomers();
    expect(contents[0].name).toBeNull();
    expect(contents[1].name).toBeNull();
  });

  it("누락 필드는 안전 기본값으로 채운다(throw 하지 않음)", async () => {
    getMock.mockResolvedValue(ok({ count: 1, contents: [{ id: "c1" }] }));
    const { contents } = await getAdminCustomers();
    expect(contents[0]).toEqual({
      id: "c1",
      email: "",
      name: null,
      status: "",
      onboarded: false,
      createdAt: "",
    });
  });

  it("서버가 plan 을 보내도 매핑에 싣지 않는다(플랜제 폐지)", async () => {
    // 크레딧제로 전환돼 요금제 개념이 없다. BAC-16 이 계약 초안대로 plan 을 계속 내려보내더라도
    // 관리자 화면에 없는 개념이 되살아나지 않도록 경계에서 버린다.
    getMock.mockResolvedValue(
      ok({ count: 1, contents: [{ id: "c1", plan: "pro" }] }),
    );
    const { contents } = await getAdminCustomers();
    expect(contents[0]).not.toHaveProperty("plan");
  });

  it("contents 가 null 이어도 빈 배열로 흡수한다", async () => {
    getMock.mockResolvedValue(ok({ count: 0, contents: null }));
    const { contents } = await getAdminCustomers();
    expect(contents).toEqual([]);
  });

  it("data 래퍼가 통째로 없어도 빈 목록을 반환한다", async () => {
    getMock.mockResolvedValue({ status: "success", message: "" });
    const { count, contents } = await getAdminCustomers();
    expect(count).toBeNull();
    expect(contents).toEqual([]);
  });

  it("본문이 data 래퍼 없이 { count, contents } 로 와도 최상위에서 읽는다", async () => {
    // BAC-16/스테이징이 봉투 없이 본문을 그대로 보내는 경우. res.data 가 undefined 라도
    // 최상위로 폴백해야 목록이 조용히 0명이 되지 않는다(Codex review).
    getMock.mockResolvedValue({ count: 42, contents: [{ id: "c1" }] });
    const { count, contents } = await getAdminCustomers();
    expect(count).toBe(42);
    expect(contents).toHaveLength(1);
    expect(contents[0].id).toBe("c1");
  });

  it("count 는 페이지 길이와 달라도 서버 값을 그대로 신뢰한다(전체 건수)", async () => {
    getMock.mockResolvedValue(
      ok({ count: 137, contents: [{ id: "c1" }, { id: "c2" }] }),
    );
    const { count, contents } = await getAdminCustomers();
    expect(count).toBe(137);
    expect(contents).toHaveLength(2);
  });

  it("count 가 없으면 총계를 지어내지 않고 null(미상) 로 둔다", async () => {
    // 페이지 길이나 offset 으로 총계를 만들면 꽉 찬 페이지가 마지막 페이지처럼 보여 다음
    // 페이지가 통째로 도달 불가능해진다(Codex P2).
    getMock.mockResolvedValue(
      ok({ contents: Array.from({ length: 20 }, (_, i) => ({ id: `c${i}` })) }),
    );
    const { count, contents } = await getAdminCustomers({
      limit: 20,
      offset: 20,
    });
    expect(count).toBeNull();
    expect(contents).toHaveLength(20);
  });

  it("count 가 숫자가 아니면 미상으로 본다", async () => {
    getMock.mockResolvedValue(ok({ count: "137", contents: [{ id: "c1" }] }));
    const { count } = await getAdminCustomers();
    expect(count).toBeNull();
  });

  it("HTTP 실패는 그대로 throw 한다(삼키지 않음)", async () => {
    getMock.mockRejectedValue(new Error("500"));
    await expect(getAdminCustomers()).rejects.toThrow("500");
  });
});
