import { describe, expect, it } from "vitest"
import {
  dashToDot,
  dotToDash,
  formatPeriodString,
  inferGranularity,
  padToDay,
  parsePeriodString,
  truncateToMonth,
} from "@/lib/utils/period-format"

describe("dotToDash", () => {
  it("월 토큰의 점을 대시로 바꾼다", () => {
    expect(dotToDash("2023.03")).toBe("2023-03")
  })
  it("일 토큰의 모든 점을 대시로 바꾼다 (첫 점만 X)", () => {
    expect(dotToDash("2023.03.15")).toBe("2023-03-15")
  })
  it("빈 문자열은 그대로", () => {
    expect(dotToDash("")).toBe("")
  })
  it("이미 대시면 점이 없어 변화 없음", () => {
    expect(dotToDash("2023-03")).toBe("2023-03")
  })
})

describe("dashToDot", () => {
  it("월 토큰의 대시를 점으로 바꾼다", () => {
    expect(dashToDot("2023-03")).toBe("2023.03")
  })
  it("일 토큰의 모든 대시를 점으로 바꾼다", () => {
    expect(dashToDot("2023-03-15")).toBe("2023.03.15")
  })
  it("빈 문자열은 그대로", () => {
    expect(dashToDot("")).toBe("")
  })
})

describe("inferGranularity", () => {
  it("빈 값은 month", () => {
    expect(inferGranularity("")).toBe("month")
  })
  it("월 범위는 month", () => {
    expect(inferGranularity("2023.03 ~ 2024.01")).toBe("month")
  })
  it("월 + 현재는 month", () => {
    expect(inferGranularity("2023.03 ~ 현재")).toBe("month")
  })
  it("시작만 있는 월은 month", () => {
    expect(inferGranularity("2023.03")).toBe("month")
  })
  it("일 범위는 day", () => {
    expect(inferGranularity("2023.03.15 ~ 2024.01.20")).toBe("day")
  })
  it("일 + 현재는 day (시작 측 정밀도로 판정)", () => {
    expect(inferGranularity("2023.03.15 ~ 현재")).toBe("day")
  })
  it("시작만 있는 일은 day", () => {
    expect(inferGranularity("2023.03.15")).toBe("day")
  })
})

describe("parsePeriodString", () => {
  it("빈 값", () => {
    expect(parsePeriodString("")).toEqual({
      start: "",
      end: "",
      isCurrent: false,
      granularity: "month",
    })
  })
  it("월 범위", () => {
    expect(parsePeriodString("2023.03 ~ 2024.01")).toEqual({
      start: "2023-03",
      end: "2024-01",
      isCurrent: false,
      granularity: "month",
    })
  })
  it("월 + 현재", () => {
    expect(parsePeriodString("2023.03 ~ 현재")).toEqual({
      start: "2023-03",
      end: "",
      isCurrent: true,
      granularity: "month",
    })
  })
  it("일 범위", () => {
    expect(parsePeriodString("2023.03.15 ~ 2024.01.20")).toEqual({
      start: "2023-03-15",
      end: "2024-01-20",
      isCurrent: false,
      granularity: "day",
    })
  })
  it("일 + 현재", () => {
    expect(parsePeriodString("2023.03.15 ~ 현재")).toEqual({
      start: "2023-03-15",
      end: "",
      isCurrent: true,
      granularity: "day",
    })
  })
  it("시작만 (틸드 없음)", () => {
    expect(parsePeriodString("2023.03")).toEqual({
      start: "2023-03",
      end: "",
      isCurrent: false,
      granularity: "month",
    })
  })
})

describe("formatPeriodString", () => {
  it("월 범위", () => {
    expect(formatPeriodString({ start: "2023-03", end: "2024-01", isCurrent: false })).toBe(
      "2023.03 ~ 2024.01",
    )
  })
  it("월 + 현재", () => {
    expect(formatPeriodString({ start: "2023-03", end: "", isCurrent: true })).toBe(
      "2023.03 ~ 현재",
    )
  })
  it("일 범위", () => {
    expect(
      formatPeriodString({ start: "2023-03-15", end: "2024-01-20", isCurrent: false }),
    ).toBe("2023.03.15 ~ 2024.01.20")
  })
  it("일 + 현재", () => {
    expect(formatPeriodString({ start: "2023-03-15", end: "", isCurrent: true })).toBe(
      "2023.03.15 ~ 현재",
    )
  })
  it("빈 시작은 빈 문자열", () => {
    expect(formatPeriodString({ start: "", end: "", isCurrent: false })).toBe("")
  })
  it("시작만 있고 끝 없음 (틸드 없음)", () => {
    expect(formatPeriodString({ start: "2023-03", end: "", isCurrent: false })).toBe("2023.03")
  })
})

describe("truncateToMonth", () => {
  it("일을 월로 절삭", () => {
    expect(truncateToMonth("2023-03-15")).toBe("2023-03")
  })
  it("이미 월이면 그대로", () => {
    expect(truncateToMonth("2023-03")).toBe("2023-03")
  })
  it("빈 값은 그대로", () => {
    expect(truncateToMonth("")).toBe("")
  })
})

describe("padToDay", () => {
  it("월을 1일로 채움", () => {
    expect(padToDay("2023-03")).toBe("2023-03-01")
  })
  it("이미 일이면 그대로", () => {
    expect(padToDay("2023-03-15")).toBe("2023-03-15")
  })
  it("빈 값은 그대로", () => {
    expect(padToDay("")).toBe("")
  })
})

describe("round-trip 불변식", () => {
  const cases = [
    "",
    "2023.03 ~ 2024.01",
    "2023.03 ~ 현재",
    "2023.03.15 ~ 2024.01.20",
    "2023.03.15 ~ 현재",
    "2023.03",
  ]
  it.each(cases)("format(parse(%s)) === 원본", (s) => {
    const parsed = parsePeriodString(s)
    expect(formatPeriodString(parsed)).toBe(s)
  })
})
