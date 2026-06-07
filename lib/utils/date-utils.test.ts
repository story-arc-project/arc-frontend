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

  // 알 수 없는 입력("garbage")은 현재 "NaN일 전" 을 만든다. 버그를 정답으로 박지 않고
  // 폴백 처리는 별도 후속으로 남긴다.
  it.todo("유효하지 않은 ISO 입력은 NaN 대신 폴백 문자열을 반환해야 한다")
})
