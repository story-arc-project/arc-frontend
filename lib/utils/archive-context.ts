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
  if (f.tags && f.tags.length > 0) params.set(PARAM.tags, f.tags.join(","))
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

  const tags = params.get(PARAM.tags)
  if (tags) {
    const ts = tags.split(",").filter(Boolean)
    if (ts.length > 0) filter.tags = ts
  }

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

// `[/basePath]/archive` 형태의 목록 경로만 허용하는 화이트리스트(쿼리·프래그먼트 제외한 경로부).
const ARCHIVE_PATH = /^(\/[\w-]+)?\/archive$/

/**
 * returnTo 는 URL 에서 온 신뢰 불가 문자열이다(FRT-82). 같은 출처의 archive 목록
 * 상대경로만 통과시키고, 외부 URL·프로토콜 상대(`//host`)·`javascript:` 스킴·archive
 * 목록이 아닌 경로는 fallback 으로 무력화해 오픈 리다이렉트를 막는다.
 *
 * 입력은 이미 `searchParams.get` 이 1회 디코딩한 값이므로 여기서 추가 디코딩하지 않는다
 * (내부 쿼리의 `%26` 등을 보존해야 소비 측 router.push 후 필터가 온전히 복원된다).
 */
export function safeReturnTo(
  returnTo: string | null | undefined,
  fallback: string,
): string {
  if (!returnTo) return fallback
  // 반드시 단일 '/' 로 시작하는 절대경로. '//' 는 프로토콜 상대 URL(외부)이라 거절.
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return fallback
  const path = returnTo.split(/[?#]/, 1)[0]
  if (!ARCHIVE_PATH.test(path)) return fallback
  return returnTo
}
