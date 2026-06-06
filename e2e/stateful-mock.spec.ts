import { expect, test, type Page } from "@playwright/test";

import type { ApiSuccessResponse } from "@/types/api";
import type { Experience, ExperienceListData } from "@/types/experience";
import type { BookmarkedSnapshot } from "@/types/analysis";
import type { ResumeListItem, ResumeVersion } from "@/types/resume";

import { STUB_API_URL, stubApi } from "./fixtures/stub-api";

/**
 * FRT-42 검증 스펙 — Stateful E2E mock.
 *
 * FRT-28 스텁이 GET-only·stateless 였던 것을, 변이(POST/PUT/PATCH/DELETE)가 인메모리
 * 상태를 바꾸고 이후 GET 이 그 변화를 반영하도록 확장했음을 검증한다. 백엔드 없이도
 * "생성→다른 호출에서 보임" 같은 흐름이 성립함을 보이는 **동작 E2E 의 토대**다.
 *
 * 화면(UI) 흐름은 FRT-43 소관이므로, 여기서는 FRT-28 과 동일하게 페이지 컨텍스트에서
 * 직접 fetch 해 **mock 메커니즘 자체**(상태 반영·봉투·CORS·payload 캡처)만 검증한다.
 * fetch 는 `lib/api/client.ts` 의 request() 와 동일하게 `credentials: "include"` +
 * `Content-Type: application/json` 으로 보낸다(실제 cross-origin 경로 재현).
 *
 * 각 변이 응답의 봉투를 그 변이를 소비하는 실제 client 함수가 읽는 필드(예: create →
 * `res.data.id`)로 단언해, raw fetch 가 우회하는 `client.ts` 언랩 계약까지 고정한다.
 *
 * 격리: 각 테스트는 `stubApi` 를 새로 호출하므로 fresh 한 store 클로저를 받는다
 * (전역 누수 없음). 모든 테스트가 시드 상태(예: 경험 2건)에서 독립적으로 출발한다.
 */

interface FetchResult {
  ok: boolean;
  status: number;
  json: unknown;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** 페이지 컨텍스트에서 credentialed cross-origin 요청을 보낸다(앱 fetch 경로 재현). */
async function apiFetch(
  page: Page,
  method: Method,
  path: string,
  body?: unknown,
): Promise<FetchResult> {
  return page.evaluate(
    async ({ apiUrl, method, path, body }) => {
      const res = await fetch(`${apiUrl}${path}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json: unknown = undefined;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = text;
      }
      return { ok: res.ok, status: res.status, json };
    },
    { apiUrl: STUB_API_URL, method, path, body },
  );
}

function data<T>(result: FetchResult): T {
  return (result.json as ApiSuccessResponse<T>).data;
}

test.describe("FRT-42 Stateful E2E mock", () => {
  // ── Experiences ─────────────────────────────────────────────

  test("experiences: create → 이후 GET 목록/상세에 반영된다", async ({ page }) => {
    const stub = await stubApi(page, { authed: true });
    await page.goto("/landing");

    const before = data<ExperienceListData>(await apiFetch(page, "GET", "/experiences/"));
    expect(before.count).toBe(2);

    const payload = {
      type: "contest",
      importance: 5,
      content: { title: "신규 경험", summary: "방금 만든 경험" },
    };
    const created = await apiFetch(page, "POST", "/experiences/", payload);
    expect(created.ok).toBe(true);
    // create 의 실제 소비 필드는 res.data.id (experience-api.createExperience).
    const newId = data<{ id: string }>(created).id;
    expect(typeof newId).toBe("string");
    expect(newId.length).toBeGreaterThan(0);

    const after = data<ExperienceListData>(await apiFetch(page, "GET", "/experiences/"));
    expect(after.count).toBe(3);
    const detail = data<Experience>(await apiFetch(page, "GET", `/experiences/${newId}`));
    expect(detail.type).toBe("contest");
    expect(detail.content.title).toBe("신규 경험");

    // payload 캡처(AC#2): 앱이 보낸 변이 body 를 테스트에서 단언할 수 있다.
    const creates = stub.mutations.filter(
      (m) => m.method === "POST" && m.path === "/experiences/",
    );
    expect(creates).toHaveLength(1);
    expect(creates[0].body).toMatchObject({
      type: "contest",
      content: { title: "신규 경험" },
    });
  });

  test("experiences: update → 이후 GET 상세에 반영된다", async ({ page }) => {
    await stubApi(page, { authed: true });
    await page.goto("/landing");

    const res = await apiFetch(page, "PUT", "/experiences/exp-e2e-1", {
      importance: 1,
      content: { title: "수정된 제목" },
    });
    expect(res.ok).toBe(true);

    const detail = data<Experience>(await apiFetch(page, "GET", "/experiences/exp-e2e-1"));
    expect(detail.importance).toBe(1);
    expect(detail.content.title).toBe("수정된 제목");
  });

  test("experiences: delete → 목록에서 사라지고 상세는 404", async ({ page }) => {
    await stubApi(page, { authed: true });
    await page.goto("/landing");

    const res = await apiFetch(page, "DELETE", "/experiences/exp-e2e-1");
    expect(res.ok).toBe(true);

    const after = data<ExperienceListData>(await apiFetch(page, "GET", "/experiences/"));
    expect(after.count).toBe(1);
    expect(after.contents.some((e) => e.id === "exp-e2e-1")).toBe(false);

    const detail = await apiFetch(page, "GET", "/experiences/exp-e2e-1");
    expect(detail.status).toBe(404);
  });

  // ── Bookmarks ───────────────────────────────────────────────

  test("bookmarks: add → 목록에 보이고, remove → 사라진다", async ({ page }) => {
    await stubApi(page, { authed: true });
    await page.goto("/landing");

    const seed = data<BookmarkedSnapshot[]>(await apiFetch(page, "GET", "/analysis/bookmarks"));
    expect(seed.map((b) => b.id)).toEqual(["ind-1"]);

    const added = await apiFetch(page, "POST", "/analysis/bookmarks/comp-1");
    expect(added.ok).toBe(true);

    const afterAdd = data<BookmarkedSnapshot[]>(
      await apiFetch(page, "GET", "/analysis/bookmarks"),
    );
    expect(afterAdd.map((b) => b.id).sort()).toEqual(["comp-1", "ind-1"]);
    expect(afterAdd.every((b) => b.isBookmarked)).toBe(true);

    const removed = await apiFetch(page, "DELETE", "/analysis/bookmarks/ind-1");
    expect(removed.ok).toBe(true);

    const afterRemove = data<BookmarkedSnapshot[]>(
      await apiFetch(page, "GET", "/analysis/bookmarks"),
    );
    expect(afterRemove.map((b) => b.id)).toEqual(["comp-1"]);
  });

  // ── Resume (Export) ─────────────────────────────────────────

  test("resume: create → 목록 반영, update → 반영, delete → 사라짐", async ({ page }) => {
    await stubApi(page, { authed: true });
    await page.goto("/landing");

    const before = data<ResumeListItem[]>(await apiFetch(page, "GET", "/export/resume"));
    expect(before.map((r) => r.version_id)).toEqual(["resume-e2e-1"]);

    // create: 실제 소비 필드는 res.data(ResumeVersion) — export-api.createResume.
    const created = await apiFetch(page, "POST", "/export/resume", { language: "en" });
    expect(created.ok).toBe(true);
    const version = data<ResumeVersion>(created);
    expect(version.meta.language).toBe("en");
    const newId = version.version_id;
    expect(typeof newId).toBe("string");
    expect(newId).not.toBe("resume-e2e-1");

    const afterCreate = data<ResumeListItem[]>(await apiFetch(page, "GET", "/export/resume"));
    expect(afterCreate.map((r) => r.version_id).sort()).toEqual(
      ["resume-e2e-1", newId].sort(),
    );

    // update(PATCH): res.data 가 갱신된 ResumeVersion — export-api.updateResume.
    const updatedVersion: ResumeVersion = { ...version, 자기소개_요약: "갱신된 요약" };
    const patched = await apiFetch(page, "PATCH", `/export/resume/${newId}`, updatedVersion);
    expect(patched.ok).toBe(true);
    expect(data<ResumeVersion>(patched).자기소개_요약).toBe("갱신된 요약");
    const detail = data<ResumeVersion>(await apiFetch(page, "GET", `/export/resume/${newId}`));
    expect(detail.자기소개_요약).toBe("갱신된 요약");

    // delete: 목록에서 사라지고 상세는 404.
    const deleted = await apiFetch(page, "DELETE", "/export/resume/resume-e2e-1");
    expect(deleted.ok).toBe(true);
    const afterDelete = data<ResumeListItem[]>(await apiFetch(page, "GET", "/export/resume"));
    expect(afterDelete.map((r) => r.version_id)).toEqual([newId]);
    const goneDetail = await apiFetch(page, "GET", "/export/resume/resume-e2e-1");
    expect(goneDetail.status).toBe(404);
  });

  // ── Isolation ───────────────────────────────────────────────

  test("격리: 직전 변이가 누수되지 않고 fresh 시드에서 출발한다", async ({ page }) => {
    await stubApi(page, { authed: true });
    await page.goto("/landing");

    const exp = data<ExperienceListData>(await apiFetch(page, "GET", "/experiences/"));
    expect(exp.count).toBe(2);
    const bookmarks = data<BookmarkedSnapshot[]>(
      await apiFetch(page, "GET", "/analysis/bookmarks"),
    );
    expect(bookmarks.map((b) => b.id)).toEqual(["ind-1"]);
  });
});
