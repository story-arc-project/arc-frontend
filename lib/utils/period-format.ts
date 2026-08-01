/**
 * 기간(period) 입력 문자열 파싱/직렬화 유틸.
 *
 * 저장 포맷은 점 구분 문자열이다:
 *   월 단위: "2023.03 ~ 2024.01" | "2023.03 ~ 현재" | "2023.03"
 *   일 단위: "2023.03.15 ~ 2024.01.20" | "2023.03.15 ~ 현재"
 *
 * 브라우저 date/month 입력값은 대시 구분("2023-03", "2023-03-15")이므로
 * 양방향 변환이 필요하다. granularity(월/일)는 시작 토큰의 점 개수로 추론한다.
 */

export type PeriodGranularity = "month" | "day"

const SEP = " ~ "
const CURRENT = "현재"

/** 점 구분 토큰 → 대시 구분(브라우저 입력값). 모든 점을 치환한다. */
export function dotToDash(token: string): string {
  return token.replace(/\./g, "-")
}

/** 대시 구분(브라우저 입력값) → 점 구분 토큰. 모든 대시를 치환한다. */
export function dashToDot(token: string): string {
  return token.replace(/-/g, ".")
}

/** 저장 문자열의 시작 토큰 점 개수로 granularity 추론(빈 값=month). */
export function inferGranularity(periodString: string): PeriodGranularity {
  const start = periodString.split("~")[0]?.trim() ?? ""
  // "YYYY.MM.DD" → 점 2개 = day, "YYYY.MM" → 점 1개 = month
  return (start.match(/\./g)?.length ?? 0) >= 2 ? "day" : "month"
}

/** 저장 문자열 → 컨트롤드 입력 상태(start/end는 대시 포맷). */
export function parsePeriodString(periodString: string): {
  start: string
  end: string
  isCurrent: boolean
  granularity: PeriodGranularity
} {
  const granularity = inferGranularity(periodString)
  const isCurrent = periodString.includes(CURRENT)
  const parts = periodString.split("~").map((s) => s.trim())
  const start = dotToDash(parts[0] ?? "")
  const end = isCurrent ? "" : dotToDash(parts[1] ?? "")
  return { start, end, isCurrent, granularity }
}

/** 컨트롤드 입력 상태(대시 포맷) → 저장 문자열(점 포맷). */
export function formatPeriodString(opts: {
  start: string
  end: string
  isCurrent: boolean
}): string {
  const start = dashToDot(opts.start)
  const end = opts.isCurrent ? CURRENT : dashToDot(opts.end)
  // start 가 비어도 end(또는 '현재')가 있으면 버리지 않는다 — 종료를 먼저 고르거나
  // 시작을 지우는 순서에서 방금 입력한 값이 조용히 사라지는 걸 막는다(FRT-213 리뷰 발견).
  if (!start && !end) return ""
  if (!opts.isCurrent && !opts.end) return start
  return `${start}${SEP}${end}`
}

/** 일 단위 입력값을 월 단위로 절삭. "2023-03-15" → "2023-03". */
export function truncateToMonth(dashValue: string): string {
  return dashValue.split("-").slice(0, 2).join("-")
}

/** 토큰이 일(日)까지 가진 값인가. "2023-03-15" → true, "2023-03" → false. */
export function hasDayPrecision(dashToken: string): boolean {
  return dashToken.split("-").length >= 3
}

/**
 * 브라우저의 month/date 입력은 **달력에 실재하는** 값만 받는다 — 자릿수만 맞는
 * `"2023-13"`·`"2023-02-30"` 은 무효로 보고 빈 칸을 그린다. 형식 검사만 하면
 * 안내가 가장 필요한 자리에서 빠지므로 실재 여부까지 따진다.
 *
 * 이 값을 보는 곳이 둘 이상이다(셀 렌더러의 안내 · 진행도 판정) — 기준이 갈리면
 * 화면은 빈 칸인데 진행도는 완료라고 말한다. 한 곳에서만 정의한다.
 */
export function isRealMonth(dashToken: string): boolean {
  const parts = /^(\d{4})-(\d{2})$/.exec(dashToken)
  if (!parts) return false
  const month = Number(parts[2])
  return month >= 1 && month <= 12
}

export function isRealDay(dashToken: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dashToken)
  if (!parts) return false
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])]
  // 넘치는 값은 다음 달·해로 굴러가므로, 되읽어 그대로면 실재하는 날짜다.
  const at = new Date(Date.UTC(year, month - 1, day))
  return at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === day
}

/**
 * 월 단위 입력값을 일 단위로 보정(1일로 채움). "2023-03" → "2023-03-01".
 * 빈 값·이미 일 단위 값은 그대로 둔다. month → day 전환 시 type=date 입력이
 * 빈 컨트롤로 보이거나 혼합 granularity로 직렬화되는 것을 막는다.
 */
export function padToDay(dashValue: string): string {
  return dashValue.split("-").length === 2 ? `${dashValue}-01` : dashValue
}
