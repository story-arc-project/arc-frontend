import { expect, test, type Page } from "@playwright/test";

import type { ApiSuccessResponse } from "@/types/api";
import type { ExperienceListData } from "@/types/experience";
import type { AnalysisSnapshot, AnalysisStatus, BookmarkedSnapshot } from "@/types/analysis";
import type { ResumeListItem, ResumeVersion } from "@/types/resume";
import type { LibraryDTO } from "@/lib/utils/library-mapper";
import type { PresetDTO } from "@/lib/utils/preset-mapper";

import { STUB_API_URL, stubApi } from "./fixtures/stub-api";

/**
 * FRT-28 검증 스펙.
 *
 * 데이터 엔드포인트 스텁이 (1) 백엔드 없이 일관된 응답을 반환하고 (2) 빈/데이터
 * 기본 상태를 커버하며 (3) 미정의 경로로 네트워크가 새지 않음을 확인한다.
 *
 * 화면 렌더링 검증은 FRT-30(스모크) 소관이므로, 여기서는 `(main)` 진입 대신
 * 페이지 컨텍스트에서 직접 fetch 해 스텁 자체의 계약만 검증한다.
 *
 * fetch 는 `lib/api/client.ts` 의 request() 와 동일하게
 * `credentials: "include"` + `Content-Type: application/json` 로 보낸다.
 * (실제 앱이 타는 cross-origin·preflight 경로를 그대로 재현해 false green 을 막는다.)
 */

interface FetchResult {
  ok: boolean;
  status: number;
  json: unknown;
}

interface LibraryListData {
  count: number;
  contents: { system: LibraryDTO[]; custom: LibraryDTO[] };
}

async function collect(page: Page, paths: string[]): Promise<Record<string, FetchResult>> {
  return page.evaluate(
    async ({ apiUrl, targets }) => {
      const out: Record<string, { ok: boolean; status: number; json: unknown }> = {};
      for (const p of targets) {
        const res = await fetch(`${apiUrl}${p}`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        out[p] = { ok: res.ok, status: res.status, json: (await res.json()) as unknown };
      }
      return out;
    },
    { apiUrl: STUB_API_URL, targets: paths },
  );
}

function envelope<T>(result: FetchResult): ApiSuccessResponse<T> {
  return result.json as ApiSuccessResponse<T>;
}

test.describe("FRT-28 API 스텁 fixtures", () => {
  test("data 시나리오: 모든 데이터 엔드포인트가 채워진 응답을 반환한다", async ({ page }) => {
    await stubApi(page); // 기본 "data"
    await page.goto("/landing"); // cross-origin fetch 를 위한 페이지 origin 확보

    const results = await collect(page, [
      "/experiences/",
      "/experiences/exp-e2e-1",
      "/libraries/",
      "/libraries/lib-custom-1/experiences",
      "/presets/",
      "/analysis/individual",
      "/analysis/individual/ind-1",
      "/analysis/comprehensive",
      "/analysis/keyword",
      "/analysis/status/ind-1",
      "/analysis/bookmarks",
      "/export/resume",
      "/export/resume/resume-e2e-1",
    ]);

    // 모든 응답이 정상 fulfill(브라우저가 CORS 통과로 읽음)되었는지.
    for (const [path, res] of Object.entries(results)) {
      expect(res.ok, `${path} 는 200이어야 한다`).toBe(true);
    }

    // Experiences
    const exp = envelope<ExperienceListData>(results["/experiences/"]).data;
    expect(exp.count).toBe(2);
    expect(exp.contents).toHaveLength(2);
    expect(exp.contents[0].content.title).toBeTruthy();

    // Libraries — system/custom 분리 형태
    const libs = envelope<LibraryListData>(results["/libraries/"]).data;
    expect(libs.contents.system).toHaveLength(2);
    expect(libs.contents.custom).toHaveLength(1);

    const libExp = envelope<ExperienceListData>(
      results["/libraries/lib-custom-1/experiences"],
    ).data;
    expect(libExp.contents).toHaveLength(1);

    // Presets — { count, contents }
    const presets = envelope<{ count: number; contents: PresetDTO[] }>(
      results["/presets/"],
    ).data;
    expect(presets.contents).toHaveLength(1);

    // Analysis lists (data 는 배열)
    const individual = envelope<AnalysisSnapshot[]>(results["/analysis/individual"]).data;
    expect(individual).toHaveLength(1);
    expect(individual[0].type).toBe("individual");

    const comprehensive = envelope<AnalysisSnapshot[]>(results["/analysis/comprehensive"]).data;
    expect(comprehensive).toHaveLength(1);

    const keyword = envelope<AnalysisSnapshot[]>(results["/analysis/keyword"]).data;
    expect(keyword).toHaveLength(1);

    // Analysis detail
    const indDetail = envelope<{ result: { itemName: string } }>(
      results["/analysis/individual/ind-1"],
    ).data;
    expect(indDetail.result.itemName).toBeTruthy();

    // Analysis status — 봉투 없이 raw `{ status }` (data 래퍼가 없어야 한다)
    const statusBody = results["/analysis/status/ind-1"].json as {
      status: AnalysisStatus;
      data?: unknown;
    };
    expect(statusBody.status).toBe("completed");
    expect(statusBody.data).toBeUndefined();

    // Bookmarks
    const bookmarks = envelope<BookmarkedSnapshot[]>(results["/analysis/bookmarks"]).data;
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].bookmarkedAt).toBeTruthy();

    // Resume list (data 는 배열) + detail
    const resumeListData = envelope<ResumeListItem[]>(results["/export/resume"]).data;
    expect(Array.isArray(resumeListData)).toBe(true);
    expect(resumeListData).toHaveLength(1);

    const resumeDetailData = envelope<ResumeVersion>(
      results["/export/resume/resume-e2e-1"],
    ).data;
    expect(resumeDetailData.meta.language).toBe("ko");
  });

  test("empty 시나리오: 목록 엔드포인트가 빈 상태를 반환한다", async ({ page }) => {
    await stubApi(page, { scenario: "empty" });
    await page.goto("/landing");

    const results = await collect(page, [
      "/experiences/",
      "/libraries/",
      "/presets/",
      "/analysis/individual",
      "/analysis/comprehensive",
      "/analysis/keyword",
      "/analysis/bookmarks",
      "/export/resume",
    ]);

    const exp = envelope<ExperienceListData>(results["/experiences/"]).data;
    expect(exp.count).toBe(0);
    expect(exp.contents).toHaveLength(0);

    const libs = envelope<LibraryListData>(results["/libraries/"]).data;
    expect(libs.contents.system).toHaveLength(0);
    expect(libs.contents.custom).toHaveLength(0);

    expect(
      envelope<{ contents: PresetDTO[] }>(results["/presets/"]).data.contents,
    ).toHaveLength(0);

    expect(envelope<AnalysisSnapshot[]>(results["/analysis/individual"]).data).toHaveLength(0);
    expect(envelope<AnalysisSnapshot[]>(results["/analysis/comprehensive"]).data).toHaveLength(0);
    expect(envelope<AnalysisSnapshot[]>(results["/analysis/keyword"]).data).toHaveLength(0);
    expect(envelope<BookmarkedSnapshot[]>(results["/analysis/bookmarks"]).data).toHaveLength(0);
    expect(envelope<ResumeListItem[]>(results["/export/resume"]).data).toHaveLength(0);
  });

  test("미정의 엔드포인트는 네트워크 누수 없이 404로 응답한다", async ({ page }) => {
    await stubApi(page);
    await page.goto("/landing");

    const results = await collect(page, ["/unknown/endpoint"]);
    const res = results["/unknown/endpoint"];

    expect(res.status).toBe(404);
    const body = res.json as { code: string };
    expect(body.code).toBe("E2E_STUB_NOT_FOUND");
  });
});
