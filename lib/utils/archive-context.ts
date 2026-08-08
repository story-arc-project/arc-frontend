import type {
  LibraryFilter,
  SortBy,
  ExperienceStatus,
  ExperienceTypeId,
} from "@/types/archive"
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper"
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2"

/**
 * Archive 리스트 페이지의 "뷰 컨텍스트" — 활성 라이브러리 + 사용자 필터.
 * 편집/새경험 라우트로 나갈 때 returnTo 쿼리에 실어 왕복 보존한다(FRT-82).
 */
export interface ArchiveContext {
  libraryId: string
  filter: LibraryFilter
}

// URL 파라미터 키. `id`(선택 레코드)는 리스트 페이지 기존 규약을 그대로 재사용한다.
const PARAM = {
  lib: "lib",
  search: "q",
  sort: "sort",
  type: "type",
  status: "status",
  tags: "tags",
} as const

const SORT_VALUES: readonly SortBy[] = ["updated", "period", "completion"]
const STATUS_VALUES: readonly ExperienceStatus[] = ["draft", "complete"]

function isSortBy(v: string): v is SortBy {
  return (SORT_VALUES as readonly string[]).includes(v)
}
function isStatus(v: string): v is ExperienceStatus {
  return (STATUS_VALUES as readonly string[]).includes(v)
}
function isTypeId(v: string): v is ExperienceTypeId {
  return Object.prototype.hasOwnProperty.call(EXPERIENCE_TYPE_MAP, v)
}

/**
 * ArchiveContext → URLSearchParams. 디폴트값(전체 라이브러리 · updated 정렬 · 빈 필터)은
 * URL을 깨끗하게 유지하도록 생략한다.
 */
function contextToParams(ctx: ArchiveContext): URLSearchParams {
  const params = new URLSearchParams()
  if (ctx.libraryId && ctx.libraryId !== ALL_LIBRARY_ID) {
    params.set(PARAM.lib, ctx.libraryId)
  }
  const f = ctx.filter
  if (f.search) params.set(PARAM.search, f.search)
  if (f.sortBy && f.sortBy !== "updated") params.set(PARAM.sort, f.sortBy)
  if (f.typeIds && f.typeIds.length > 0) params.set(PARAM.type, f.typeIds.join(","))
  if (f.statuses && f.statuses.length > 0) params.set(PARAM.status, f.statuses.join(","))
  // 유형·상태는 화이트리스트 enum 이라 쉼표로 이어 붙여도 안전하지만, tags 는 사용자가 자유롭게
  // 입력하는 문자열이라 값 안에 쉼표가 섞일 수 있다(TagsBlock·ExperienceFormV2 의 TagInput 은
  // trim 만 한다). 구분자를 재사용하면 "AI, ML" 이 왕복에서 두 태그로 갈라지므로 구분자를 쓰지
  // 않고 반복 파라미터로 싣는다 — URLSearchParams 가 값별로 인코딩해 왕복이 손실 없이 닫힌다(FRT-162).
  if (f.tags) {
    for (const tag of f.tags) params.append(PARAM.tags, tag)
  }
  return params
}

/** ArchiveContext를 선행 '?' 없는 쿼리 조각으로 직렬화한다. */
export function serializeArchiveContext(ctx: ArchiveContext): string {
  return contextToParams(ctx).toString()
}

/**
 * URLSearchParams → ArchiveContext. 화이트리스트에 없는 유형/상태/정렬 값은 조용히 버린다.
 * 유효한 라이브러리/필터 정보가 하나도 없으면(예: `?id=`만 있는 복귀 URL) undefined를 반환한다.
 */
export function parseArchiveContext(
  params: URLSearchParams,
): ArchiveContext | undefined {
  const lib = params.get(PARAM.lib)
  const filter: LibraryFilter = {}

  const search = params.get(PARAM.search)
  if (search) filter.search = search

  const sort = params.get(PARAM.sort)
  if (sort && isSortBy(sort)) filter.sortBy = sort

  const type = params.get(PARAM.type)
  if (type) {
    const ids = type.split(",").filter(isTypeId)
    if (ids.length > 0) filter.typeIds = ids
  }

  const status = params.get(PARAM.status)
  if (status) {
    const ss = status.split(",").filter(isStatus)
    if (ss.length > 0) filter.statuses = ss
  }

  // 반복 파라미터로 실린 태그를 값 단위로 되읽는다(contextToParams 참고). 옛 `tags=a,b` 형식을
  // 쉼표로 쪼개는 하위호환 폴백은 두지 않는다 — 그 폴백이 곧 "쉼표는 구분자"라는 선언이라
  // 쉼표를 품은 태그를 다시 갈라놓는다. 태그 필터를 켜는 UI 가 아직 없어(useLibraryFilter 의
  // toggleTagFilter 는 호출처가 없다) 옛 형식이 실린 URL 도 실존하지 않는다(FRT-162).
  const ts = params.getAll(PARAM.tags).filter(Boolean)
  if (ts.length > 0) filter.tags = ts

  const hasLib = !!lib && lib !== ALL_LIBRARY_ID
  const hasFilter = Object.keys(filter).length > 0
  if (!hasLib && !hasFilter) return undefined

  return { libraryId: hasLib ? lib! : ALL_LIBRARY_ID, filter }
}

/**
 * 편집/새경험 라우트에 실어보낼 returnTo(완성형 상대 URL) 문자열을 만든다.
 * basePath가 내장되므로 소비 측(edit/new)에서 basePath를 다시 붙이면 안 된다.
 */
export function buildReturnTo(
  basePath: string,
  ctx: ArchiveContext,
  id?: string,
): string {
  const params = contextToParams(ctx)
  if (id) params.set("id", id)
  const qs = params.toString()
  return `${basePath}/archive${qs ? `?${qs}` : ""}`
}

/**
 * returnTo 는 URL 에서 온 신뢰 불가 문자열이다(FRT-82). **현재 앱 컨텍스트(basePath)의**
 * archive 목록 경로(`${basePath}/archive`)만 정확히 통과시키고, 외부 URL·프로토콜
 * 상대(`//host`)·`javascript:` 스킴·다른 basePath(예: 메인↔`/demo` 이탈)·존재하지 않는
 * 세그먼트(`/foo/archive` → 404)·archive 목록이 아닌 경로는 fallback 으로 무력화한다.
 *
 * 임의의 단일 세그먼트를 허용하면 `/demo/archive/new?returnTo=/archive` 처럼 URL 조작으로
 * 앱 컨텍스트를 갈아탈 수 있으므로(Codex P2), 소비 측이 가진 basePath 와 정확히 대조한다.
 *
 * 입력은 이미 `searchParams.get` 이 1회 디코딩한 값이므로 여기서 추가 디코딩하지 않는다
 * (내부 쿼리의 `%26` 등을 보존해야 소비 측 router.push 후 필터가 온전히 복원된다).
 */
export function safeReturnTo(
  returnTo: string | null | undefined,
  basePath: string,
  fallback: string,
): string {
  if (!returnTo) return fallback
  // 반드시 단일 '/' 로 시작하는 절대경로. '//' 는 프로토콜 상대 URL(외부)이라 거절.
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return fallback
  const path = returnTo.split(/[?#]/, 1)[0]
  if (path !== `${basePath}/archive`) return fallback
  return returnTo
}
