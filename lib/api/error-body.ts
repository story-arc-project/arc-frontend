/**
 * 실패 응답 본문에서 `message`/`code` 만 안전하게 꺼낸다.
 *
 * 서버는 늘 `{ message, code }` 봉투를 준다고 가정할 수 없다. 특히 본문이 유효한 JSON 리터럴
 * `null` 이면 `res.json()` 은 **성공적으로** null 을 돌려주므로 `.catch()` 가 열리지 않고,
 * 곧바로 이어지는 `body.message` 접근이 TypeError 를 낸다 — 의도한 `ApiError` 대신 원시 예외가
 * 호출부(대개 `instanceof ApiError` 로만 분기)에 닿아 화면이 실패를 안내하지 못한다 (FRT-216).
 *
 * 그래서 정제기를 **단일 입구**에 둔다. client.ts(2곳)·server.ts(1곳)가 모두 여기를 지나며,
 * 각 호출부는 반환값이 항상 객체라는 것만 알면 된다.
 *
 * 이 모듈은 클라이언트/서버 양쪽에서 import 되므로 순수 함수만 둔다 —
 * `"use client"` 나 next/headers 의존을 들이지 말 것.
 */

export type ErrorBody = {
  message?: string
  code?: string
}

/** 표시·비교에 쓸 수 있는 문자열일 때만 통과시킨다. 공백뿐인 값은 폴백 문구가 뜨도록 버린다. */
function asMeaningfulString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return value.trim() === "" ? undefined : value
}

/**
 * 파싱된 본문을 `ErrorBody` 로 좁힌다.
 *
 * - 객체가 아닌 본문(`null`·문자열·숫자·배열…)은 빈 객체가 된다.
 * - `message`/`code` 는 **문자열일 때만** 채택한다. 예컨대 FastAPI 의 `detail` 배열이 `message`
 *   자리에 실려 오면, 그대로 두었을 때 화면에 `[object Object]` 가 노출된다. 버리면 대신
 *   호출부의 폴백 문구("오류가 발생했어요.")가 뜬다.
 */
export function normalizeErrorBody(raw: unknown): ErrorBody {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}

  const record = raw as Record<string, unknown>
  const body: ErrorBody = {}

  const message = asMeaningfulString(record.message)
  if (message !== undefined) body.message = message

  const code = asMeaningfulString(record.code)
  if (code !== undefined) body.code = code

  return body
}

/**
 * 실패 응답을 파싱해 `ErrorBody` 로 돌려준다. **어떤 본문에도 throw 하지 않는다.**
 * 본문은 한 번만 읽을 수 있으므로 응답당 한 번만 호출한다.
 */
export async function parseErrorBody(res: Response): Promise<ErrorBody> {
  const raw = await res.json().catch(() => null)
  return normalizeErrorBody(raw)
}
