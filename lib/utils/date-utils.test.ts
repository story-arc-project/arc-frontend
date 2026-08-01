import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/utils/date-utils"

describe("formatDate / formatDateTime", () => {
  // 출력은 ko-KR 로케일·실행 타임존에 의존하므로 연도 포함 정도만 관대하게 단언한다.
  it("ISO 문자열을 비어 있지 않은 한국어 날짜 문자열로 변환한다", () => {
    const out = formatDate("2024-03-15T12:00:00Z")
    expect(out).toContain("2024")
    expect(out.length).toBeGreaterThan(0)
  })

  it("formatDateTime 은 날짜와 시각을 포함한다", () => {
    const out = formatDateTime("2024-03-15T12:00:00Z")
    expect(out).toContain("2024")
    expect(out.length).toBeGreaterThan(0)
  })
})

describe("formatDate / formatDateTime — 빈 값·파싱 실패 폴백 (FRT-128)", () => {
  // 폴백 관례는 lib/admin/format.ts 의 formatAdminDate 와 같다:
  // 값 없음 → "—", 파싱 불가 → 원문 그대로(무슨 값이 왔는지 화면에서 볼 수 있게).
  it.each([
    ["빈 문자열", ""],
    ["null", null],
    ["undefined", undefined],
  ])("%s 이면 'Invalid Date' 대신 '—' 를 반환한다", (_label, input) => {
    expect(formatDate(input)).toBe("—")
    expect(formatDateTime(input)).toBe("—")
  })

  // new Date(null) 은 Invalid Date 가 아니라 epoch(1970-01-01)를 만든다.
  // 가드가 없으면 "그럴듯하지만 틀린 날짜"가 조용히 렌더된다.
  it("null 을 1970년으로 렌더하지 않는다", () => {
    expect(formatDate(null)).not.toContain("1970")
    expect(formatDateTime(null)).not.toContain("1970")
  })

  it("파싱 불가 문자열은 원문 그대로 반환한다", () => {
    expect(formatDate("garbage")).toBe("garbage")
    expect(formatDateTime("garbage")).toBe("garbage")
  })
})

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-01T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("1분 미만은 '방금 전'", () => {
    expect(formatRelativeTime("2024-06-01T12:00:00Z")).toBe("방금 전")
    expect(formatRelativeTime("2024-06-01T11:59:30Z")).toBe("방금 전")
  })

  it("미래 시각(diff < 0)도 '방금 전' 으로 처리한다", () => {
    expect(formatRelativeTime("2024-06-01T13:00:00Z")).toBe("방금 전")
  })

  it("분/시간/일 경계를 올바르게 표기한다", () => {
    expect(formatRelativeTime("2024-06-01T11:55:00Z")).toBe("5분 전")
    expect(formatRelativeTime("2024-06-01T11:00:00Z")).toBe("1시간 전")
    expect(formatRelativeTime("2024-06-01T09:00:00Z")).toBe("3시간 전")
    expect(formatRelativeTime("2024-05-30T12:00:00Z")).toBe("2일 전")
  })

  // FRT-128: 위 it.todo 를 채운다. 상대시각 자리에는 원문("garbage")을 그대로 두는 것이
  // 의미가 없으므로, formatDate 와 달리 파싱 불가도 "—" 로 떨어뜨린다.
  it("유효하지 않은 ISO 입력은 NaN 대신 폴백 문자열을 반환한다", () => {
    expect(formatRelativeTime("garbage")).toBe("—")
    expect(formatRelativeTime("2024-13-45T99:99:99Z")).toBe("—")
  })

  it.each([
    ["빈 문자열", ""],
    ["null", null],
    ["undefined", undefined],
  ])("%s 이면 'NaN일 전' 대신 '—' 를 반환한다", (_label, input) => {
    expect(formatRelativeTime(input)).toBe("—")
  })

  // new Date(null) → epoch 이므로 가드가 없으면 "20000일 전" 류의 값이 나온다.
  it("null 을 epoch 기준 상대시각으로 렌더하지 않는다", () => {
    expect(formatRelativeTime(null)).not.toContain("일 전")
  })
})
