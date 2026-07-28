import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
vi.mock("./client", () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
}));

import { getAdminCustomer, getAdminCustomers } from "./admin-api";

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

// ─────────────────────────────────────────────────────────────────────────────
// FRT-17: 고객 상세 + 활동 요약 (GET /admin/customers/{id}, BAC-17 미배포)
// ─────────────────────────────────────────────────────────────────────────────

function detailBody(overrides: Record<string, unknown> = {}) {
  return {
    customer: {
      id: "u1",
      email: "user@example.com",
      name: "김상협",
      status: "verified",
      onboarded: true,
      created_at: "2026-03-14T00:00:00Z",
      withdrawn_at: null,
      auth_providers: ["google"],
    },
    profile: {
      school: "○○대",
      department: "경영학과",
      affiliation: "대학생",
      affiliation_detail: "4학년",
      company: null,
      desired_role: "프로덕트 매니저",
    },
    activity: {
      experiences: { total: 12, last_at: "2026-07-21T00:00:00Z", by_status: null },
      individual_analyses: {
        total: 8,
        last_at: "2026-07-20T00:00:00Z",
        by_status: { success: 7, failed: 1 },
      },
      comprehensive_analyses: { total: 2, last_at: null, by_status: { success: 2 } },
      keyword_analyses: { total: 3, last_at: null, by_status: { success: 2, queued: 1 } },
      resumes: { total: 4, last_at: null, by_status: { success: 4 } },
    },
    ...overrides,
  };
}

describe("getAdminCustomer — 요청·매핑", () => {
  it("id 를 경로에 넣어 요청한다", async () => {
    getMock.mockResolvedValue(ok(detailBody()));
    await getAdminCustomer("u1");
    expect(getMock).toHaveBeenCalledWith("/admin/customers/u1");
  });

  it("경로에 쓰이는 id 를 인코딩한다", async () => {
    // id 는 UUID 지만, 방어 파싱된 값이나 조작된 URL 이 슬래시·쿼리 문자를 담으면 경로가
    // 다른 엔드포인트로 붕괴한다(예: "a/b?x=1" → /admin/customers/a/b?x=1).
    getMock.mockResolvedValue(ok(detailBody()));
    await getAdminCustomer("a/b?x=1");
    expect(getMock).toHaveBeenCalledWith("/admin/customers/a%2Fb%3Fx%3D1");
  });

  it("snake_case 를 camelCase 로 옮긴다", async () => {
    getMock.mockResolvedValue(ok(detailBody()));
    const detail = await getAdminCustomer("u1");
    expect(detail.customer).toEqual({
      id: "u1",
      email: "user@example.com",
      name: "김상협",
      status: "verified",
      onboarded: true,
      createdAt: "2026-03-14T00:00:00Z",
      withdrawnAt: null,
      authProviders: ["google"],
    });
    expect(detail.profile).toEqual({
      school: "○○대",
      department: "경영학과",
      affiliation: "대학생",
      affiliationDetail: "4학년",
      company: null,
      desiredRole: "프로덕트 매니저",
    });
  });

  it("봉투가 없어도 최상위 본문으로 읽는다", async () => {
    getMock.mockResolvedValue(detailBody());
    const detail = await getAdminCustomer("u1");
    expect(detail.customer.email).toBe("user@example.com");
  });

  it("탈퇴일이 있으면 그대로 보존한다", async () => {
    getMock.mockResolvedValue(
      ok(
        detailBody({
          customer: {
            id: "u1",
            email: "gone@example.com",
            status: "verified",
            withdrawn_at: "2026-07-01T00:00:00Z",
          },
        }),
      ),
    );
    const detail = await getAdminCustomer("u1");
    expect(detail.customer.withdrawnAt).toBe("2026-07-01T00:00:00Z");
  });

  it("auth_providers 가 배열이 아니면 빈 배열로 둔다", async () => {
    getMock.mockResolvedValue(
      ok(detailBody({ customer: { id: "u1", email: "a@b.c", auth_providers: null } })),
    );
    const detail = await getAdminCustomer("u1");
    expect(detail.customer.authProviders).toEqual([]);
  });

  it("auth_providers 안의 비문자열 원소는 버린다", async () => {
    getMock.mockResolvedValue(
      ok(
        detailBody({
          customer: { id: "u1", email: "a@b.c", auth_providers: ["google", 1, null] },
        }),
      ),
    );
    const detail = await getAdminCustomer("u1");
    expect(detail.customer.authProviders).toEqual(["google"]);
  });

  it("식별자가 통째로 비면 빈 상세를 그리지 않고 throw 한다", async () => {
    // id·email 이 둘 다 없으면 화면에 그릴 대상이 없다. 이걸 성공으로 통과시키면 운영자가
    // "정보가 없는 고객"을 사실로 읽는다 — 에러로 떨어뜨려 다시 시도를 띄운다.
    getMock.mockResolvedValue(ok({ profile: null, activity: {} }));
    await expect(getAdminCustomer("u1")).rejects.toThrow();
  });

  it("HTTP 실패는 그대로 throw 한다(삼키지 않음)", async () => {
    getMock.mockRejectedValue(new Error("404"));
    await expect(getAdminCustomer("u1")).rejects.toThrow("404");
  });
});

describe("getAdminCustomer — 프로필 유무 구분", () => {
  it("profile 이 null 이면 null 로 유지한다(온보딩 전)", async () => {
    getMock.mockResolvedValue(ok(detailBody({ profile: null })));
    const detail = await getAdminCustomer("u1");
    expect(detail.profile).toBeNull();
  });

  it("profile 키가 아예 없어도 null 로 본다", async () => {
    const body = detailBody();
    delete (body as Record<string, unknown>).profile;
    getMock.mockResolvedValue(ok(body));
    const detail = await getAdminCustomer("u1");
    expect(detail.profile).toBeNull();
  });

  it("빈 객체 프로필은 null 이 아니라 '전 항목 미작성'으로 구분한다", async () => {
    // 온보딩 전(프로필 없음)과 온보딩 후 미작성은 운영자에게 다른 사실이라 화면 안내도 다르다.
    getMock.mockResolvedValue(ok(detailBody({ profile: {} })));
    const detail = await getAdminCustomer("u1");
    expect(detail.profile).not.toBeNull();
    expect(detail.profile).toEqual({
      school: null,
      department: null,
      affiliation: null,
      affiliationDetail: null,
      company: null,
      desiredRole: null,
    });
  });

  it("빈 문자열 필드는 null 로 정규화한다", async () => {
    getMock.mockResolvedValue(
      ok(detailBody({ profile: { school: "", department: "경영학과" } })),
    );
    const detail = await getAdminCustomer("u1");
    expect(detail.profile?.school).toBeNull();
    expect(detail.profile?.department).toBe("경영학과");
  });

  it("계약에서 제외한 PII 가 내려와도 타입에 담지 않는다", async () => {
    // 전화·생년월일·고민·관심사는 계약에서 뺐다. 그래도 서버가 보내면 매퍼가 흘려보내지 않아야
    // 화면·상태에 실려 들어가지 않는다.
    getMock.mockResolvedValue(
      ok(
        detailBody({
          profile: {
            school: "○○대",
            phone: "010-1234-5678",
            birth: "1999-01-01",
            worry: ["진로"],
            interest: ["기획"],
          },
        }),
      ),
    );
    const detail = await getAdminCustomer("u1");
    expect(Object.keys(detail.profile ?? {}).sort()).toEqual([
      "affiliation",
      "affiliationDetail",
      "company",
      "department",
      "desiredRole",
      "school",
    ]);
  });
});

describe("getAdminCustomer — 활동 요약", () => {
  it("항목별 건수·최근 시각·상태 분해를 옮긴다", async () => {
    getMock.mockResolvedValue(ok(detailBody()));
    const { activity } = await getAdminCustomer("u1");
    expect(activity.experiences).toEqual({
      total: 12,
      lastAt: "2026-07-21T00:00:00Z",
      byStatus: null,
    });
    expect(activity.individualAnalyses).toEqual({
      total: 8,
      lastAt: "2026-07-20T00:00:00Z",
      byStatus: { success: 7, failed: 1 },
    });
    expect(activity.resumes?.total).toBe(4);
  });

  it("건수 0 은 0 으로 유지한다(미상 아님)", async () => {
    getMock.mockResolvedValue(
      ok(detailBody({ activity: { experiences: { total: 0, last_at: null } } })),
    );
    const { activity } = await getAdminCustomer("u1");
    expect(activity.experiences?.total).toBe(0);
  });

  it("건수가 숫자가 아니면 0 이 아니라 null(미상) 로 둔다", async () => {
    // 0 으로 떨구면 "활동 없는 고객"과 "집계 실패"가 화면에서 똑같아 보인다.
    getMock.mockResolvedValue(
      ok(detailBody({ activity: { experiences: { total: "12" } } })),
    );
    const { activity } = await getAdminCustomer("u1");
    expect(activity.experiences?.total).toBeNull();
  });

  it("음수·소수 건수도 미상으로 본다", async () => {
    getMock.mockResolvedValue(
      ok(
        detailBody({
          activity: { experiences: { total: -3 }, resumes: { total: 1.5 } },
        }),
      ),
    );
    const { activity } = await getAdminCustomer("u1");
    expect(activity.experiences?.total).toBeNull();
    expect(activity.resumes?.total).toBeNull();
  });

  it("서버가 안 준 항목은 null(미상) 로 둔다", async () => {
    getMock.mockResolvedValue(
      ok(detailBody({ activity: { experiences: { total: 3 } } })),
    );
    const { activity } = await getAdminCustomer("u1");
    expect(activity.experiences?.total).toBe(3);
    expect(activity.individualAnalyses).toBeNull();
    expect(activity.resumes).toBeNull();
  });

  it("activity 자체가 없거나 비객체면 전 항목이 미상이다", async () => {
    getMock.mockResolvedValue(ok(detailBody({ activity: "nope" })));
    const { activity } = await getAdminCustomer("u1");
    expect(activity).toEqual({
      experiences: null,
      individualAnalyses: null,
      comprehensiveAnalyses: null,
      keywordAnalyses: null,
      resumes: null,
    });
  });

  it("모르는 활동 키는 조용히 버린다(확장 대비)", async () => {
    // 계약 §확장 규약: 나중에 크레딧·결제 섹션이 붙어도 화면이 깨지지 않아야 한다.
    getMock.mockResolvedValue(
      ok(
        detailBody({
          activity: { experiences: { total: 1 }, credits: { total: 30 } },
        }),
      ),
    );
    const { activity } = await getAdminCustomer("u1");
    expect(activity.experiences?.total).toBe(1);
    expect("credits" in activity).toBe(false);
  });

  it("by_status 가 비객체면 null 로 둔다", async () => {
    getMock.mockResolvedValue(
      ok(detailBody({ activity: { resumes: { total: 4, by_status: "success" } } })),
    );
    const { activity } = await getAdminCustomer("u1");
    expect(activity.resumes?.byStatus).toBeNull();
  });

  it("by_status 의 비숫자 값은 버리고 숫자만 남긴다", async () => {
    getMock.mockResolvedValue(
      ok(
        detailBody({
          activity: {
            resumes: { total: 4, by_status: { success: 4, failed: "1", queued: null } },
          },
        }),
      ),
    );
    const { activity } = await getAdminCustomer("u1");
    expect(activity.resumes?.byStatus).toEqual({ success: 4 });
  });

  it("모르는 상태 키도 그대로 담는다(라벨 판단은 표시 계층 몫)", async () => {
    getMock.mockResolvedValue(
      ok(detailBody({ activity: { resumes: { total: 1, by_status: { retrying: 1 } } } })),
    );
    const { activity } = await getAdminCustomer("u1");
    expect(activity.resumes?.byStatus).toEqual({ retrying: 1 });
  });
});
