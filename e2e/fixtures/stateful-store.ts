// ─────────────────────────────────────────────────────────────
// Stateful E2E mock store (FRT-42)
//
// FRT-28 스텁은 GET-only·stateless 였다. 동작(behavior) E2E 를 위해, 변이(CRUD)가
// 인메모리 상태를 바꾸고 이후 GET 이 반영하도록 **테스트별 fresh store** 를 제공한다.
//
// 설계
// - `createStatefulStore(scenario)` 는 **순수 팩토리**다. 모든 가변 상태가 이 함수의
//   클로저 안에만 존재하므로(모듈 레벨 가변 바인딩 0), `stubApi` 호출마다 새 store 가
//   만들어져 테스트 간 전역 누수가 구조적으로 불가능하다(fullyParallel 안전).
// - **시드·shape 의 단일 출처는 `api-data.ts`** 다. 초기 GET 응답이 FRT-28 픽스처와
//   동일하므로 기존 스모크(FRT-23/28/30)가 그대로 green 이고, mock↔실계약 드리프트가
//   최소화된다. CRUD 시맨틱은 demo store(`lib/demo/store.ts`)를 모사한다(앱 코드 0줄).
// - 대상 엔티티: experiences · bookmarks · resume(export). 그 외(libraries/presets/
//   analysis 목록·상세·status)는 변이 대상이 아니라 `stub-api.ts` 의 정적 GET 으로 둔다.
// - 결정론: id 는 store 별 카운터, 시각은 고정 상수로 만든다(시계·랜덤 비의존).
// ─────────────────────────────────────────────────────────────

import type {
  Experience,
  ExperienceListData,
  ExperienceSavePayload,
  ExperienceUpdatePayload,
} from "@/types/experience";
import type { AnalysisSnapshot, BookmarkedSnapshot } from "@/types/analysis";
import type { ResumeLanguage, ResumeListItem, ResumeVersion } from "@/types/resume";

import {
  type StubScenario,
  E2E_USER_ID,
  bookmarkList,
  comprehensiveList,
  experienceList,
  individualList,
  keywordList,
  resumeDetail,
  resumeList,
} from "./api-data";

/** 변이가 시드 픽스처를 오염시키지 않도록 깊은 복제로 격리한다. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// 결정론적 타임스탬프(시계 비의존). 생성과 수정을 구분해, 수정 후 updated_at 이
// created_at 과 달라지는 실제 백엔드 동작을 모사한다.
const CREATED_AT = "2026-06-06T12:00:00.000Z";
const UPDATED_AT = "2026-06-06T13:00:00.000Z";

// ─── Experiences ────────────────────────────────────────────

export interface ExperienceStore {
  list(): ExperienceListData;
  get(id: string): Experience | undefined;
  create(payload: ExperienceSavePayload): string;
  update(id: string, payload: ExperienceUpdatePayload): boolean;
  remove(id: string): boolean;
}

function createExperienceStore(scenario: StubScenario): ExperienceStore {
  let items: Experience[] = clone(experienceList(scenario).data.contents);
  let seq = 0;

  return {
    list() {
      const contents = clone(items);
      return { count: contents.length, contents };
    },
    get(id) {
      const found = items.find((e) => e.id === id);
      return found ? clone(found) : undefined;
    },
    create(payload) {
      const id = `e2e-exp-new-${++seq}`;
      const created: Experience = {
        id,
        user_id: E2E_USER_ID,
        type: payload.type,
        importance: payload.importance ?? null,
        content: payload.content ?? {},
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      };
      items = [created, ...items];
      return id;
    },
    update(id, payload) {
      let found = false;
      items = items.map((e) => {
        if (e.id !== id) return e;
        found = true;
        return {
          ...e,
          importance: payload.importance !== undefined ? payload.importance : e.importance,
          content: payload.content !== undefined ? payload.content : e.content,
          updated_at: UPDATED_AT,
        };
      });
      return found;
    },
    remove(id) {
      const before = items.length;
      items = items.filter((e) => e.id !== id);
      return items.length < before;
    },
  };
}

// ─── Bookmarks ──────────────────────────────────────────────
// 북마크 대상 분석은 individual/comprehensive/keyword 목록 픽스처에서 가져온다.
// 시드 북마크는 bookmarkList(scenario) 와 동일(data → ind-1, empty → 없음).

export interface BookmarkStore {
  list(): BookmarkedSnapshot[];
  /** 북마크를 추가한다. 알 수 없는 분석 id 면 false(호출부가 404 로 매핑). 멱등. */
  add(id: string): boolean;
  remove(id: string): boolean;
}

function toBookmarked(snapshot: AnalysisSnapshot): BookmarkedSnapshot {
  return { ...snapshot, isBookmarked: true, bookmarkedAt: CREATED_AT };
}

function createBookmarkStore(scenario: StubScenario): BookmarkStore {
  // 북마크 가능한 분석 스냅샷 레지스트리(시나리오에 맞춘 분석 목록).
  // empty 시나리오는 분석이 없으므로 레지스트리도 비어, 알 수 없는 id add 는 404 가 된다.
  const registry = new Map<string, AnalysisSnapshot>(
    [
      ...individualList(scenario).data,
      ...comprehensiveList(scenario).data,
      ...keywordList(scenario).data,
    ].map((s) => [s.id, s]),
  );

  // 현재 북마크 상태(삽입 순서 보존). 시드는 bookmarkList(scenario) 와 동일.
  const bookmarked = new Map<string, BookmarkedSnapshot>(
    clone(bookmarkList(scenario).data).map((b) => [b.id, b]),
  );

  return {
    list() {
      return clone([...bookmarked.values()]);
    },
    add(id) {
      if (bookmarked.has(id)) return true; // 멱등
      const snapshot = registry.get(id);
      if (!snapshot) return false; // 알 수 없는 분석 → 404
      bookmarked.set(id, toBookmarked(clone(snapshot)));
      return true;
    },
    remove(id) {
      return bookmarked.delete(id);
    },
  };
}

// ─── Resume (Export) ────────────────────────────────────────
// 목록 항목과 상세 버전을 함께 보관해 "생성→목록 반영 / 상세 조회 / 삭제→404" 를 만든다.
// 상세 버전 시드는 resumeDetail() 픽스처를 각 목록 항목에 맞춰 복제한다(정합 유지).

export interface ResumeStore {
  getList(): ResumeListItem[];
  getVersion(id: string): ResumeVersion | undefined;
  create(language: ResumeLanguage): ResumeVersion;
  update(id: string, version: ResumeVersion): ResumeVersion | undefined;
  remove(id: string): boolean;
}

// export-api.ts 의 sliceSummary 와 동일 규칙이지만 그 함수는 private 이라(앱 코드 0줄
// 제약상 export 불가) 테스트 측에서 의도적으로 복제한다.
function summaryPreview(version: ResumeVersion): string | null {
  const summary = version.자기소개_요약;
  if (!summary) return null;
  const trimmed = summary.trim();
  if (!trimmed) return null;
  return trimmed.length > 50 ? `${trimmed.slice(0, 50)}…` : trimmed;
}

function createResumeStore(scenario: StubScenario): ResumeStore {
  let items: ResumeListItem[] = clone(resumeList(scenario).data);
  const seedVersion = resumeDetail().data;
  const versions = new Map<string, ResumeVersion>();
  let seq = 0;

  // 목록 항목마다 상세 버전을 시드(언어·생성시각을 목록과 정합시킨다).
  for (const item of items) {
    const v = clone(seedVersion);
    v.version_id = item.version_id;
    v.meta = { ...v.meta, language: item.language, generated_at: item.generated_at };
    versions.set(item.version_id, v);
  }

  function toListItem(version: ResumeVersion): ResumeListItem {
    return {
      version_id: version.version_id ?? "",
      language: version.meta.language,
      generated_at: version.meta.generated_at,
      summary_preview: summaryPreview(version),
    };
  }

  return {
    getList() {
      return clone(items);
    },
    getVersion(id) {
      const found = versions.get(id);
      return found ? clone(found) : undefined;
    },
    create(language) {
      const id = `e2e-resume-new-${++seq}`;
      const version = clone(seedVersion);
      version.version_id = id;
      version.meta = { ...version.meta, language, generated_at: CREATED_AT };
      versions.set(id, version);
      items = [toListItem(version), ...items];
      return clone(version);
    },
    update(id, version) {
      if (!versions.has(id)) return undefined;
      const next = clone(version);
      next.version_id = id;
      versions.set(id, next);
      // 목록 항목도 갱신해 목록↔상세 정합을 유지한다.
      items = items.map((item) => (item.version_id === id ? toListItem(next) : item));
      return clone(next);
    },
    remove(id) {
      const existed = versions.delete(id);
      items = items.filter((item) => item.version_id !== id);
      return existed;
    },
  };
}

// ─── Aggregate ──────────────────────────────────────────────

export interface StatefulStore {
  experiences: ExperienceStore;
  bookmarks: BookmarkStore;
  resume: ResumeStore;
}

/**
 * 시나리오에 맞춘 fresh stateful store 를 만든다. 반환된 store 의 모든 상태는 이
 * 호출의 클로저에만 존재한다(테스트별 격리).
 */
export function createStatefulStore(scenario: StubScenario): StatefulStore {
  return {
    experiences: createExperienceStore(scenario),
    bookmarks: createBookmarkStore(scenario),
    resume: createResumeStore(scenario),
  };
}
