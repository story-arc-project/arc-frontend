import { describe, expect, it } from "vitest"
import { normalizeErrorBody, parseErrorBody } from "@/lib/api/error-body"

function jsonResponse(raw: string, status = 500): Response {
  return new Response(raw, {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("normalizeErrorBody — 객체가 아닌 바디", () => {
  // 이 케이스가 FRT-216 그 자체다. `JSON.parse("null")` 은 실패하지 않고 null 을 돌려주므로
  // `.catch(() => ({}))` 가 개입하지 않는다.
  it("JSON 리터럴 null 은 빈 객체가 된다", () => {
    expect(normalizeErrorBody(null)).toEqual({})
  })

  it.each([
    ["undefined", undefined],
    ["문자열", "boom"],
    ["숫자", 500],
    ["boolean", false],
    ["배열", ["a", "b"]],
  ])("%s 바디는 빈 객체가 된다", (_label, raw) => {
    expect(normalizeErrorBody(raw)).toEqual({})
  })
})

describe("normalizeErrorBody — message/code 는 문자열일 때만 채택한다", () => {
  it("문자열 message·code 를 그대로 통과시킨다", () => {
    expect(normalizeErrorBody({ message: "이미 있어요", code: "DUP" })).toEqual({
      message: "이미 있어요",
      code: "DUP",
    })
  })

  it.each([
    ["객체", { detail: ["loc"] }],
    ["배열", [{ msg: "field required" }]],
    ["숫자", 42],
    ["null", null],
  ])("message 가 %s 면 버려 폴백 문구가 뜨게 한다", (_label, value) => {
    // 버리지 않으면 화면에 "[object Object]" 가 그대로 노출된다.
    expect(normalizeErrorBody({ message: value }).message).toBeUndefined()
  })

  it("code 가 문자열이 아니면 버린다", () => {
    expect(normalizeErrorBody({ code: 409 }).code).toBeUndefined()
  })

  it("빈 code 는 버린다 — 있는 코드와 같은 취급을 받지 않도록", () => {
    expect(normalizeErrorBody({ code: "" }).code).toBeUndefined()
    expect(normalizeErrorBody({ code: "  " }).code).toBeUndefined()
  })

  it("한쪽만 문자열이면 그 한쪽만 살린다", () => {
    expect(normalizeErrorBody({ message: "안돼요", code: { a: 1 } })).toEqual({
      message: "안돼요",
    })
  })

  it("빈 문자열 message 는 폴백이 뜨도록 버린다", () => {
    expect(normalizeErrorBody({ message: "   " }).message).toBeUndefined()
  })

  it("모르는 키는 무시하고 message/code 만 남긴다", () => {
    expect(normalizeErrorBody({ message: "x", code: "Y", extra: 1 })).toEqual({
      message: "x",
      code: "Y",
    })
  })
})

describe("parseErrorBody — 응답 파싱까지", () => {
  it("본문이 null 이어도 던지지 않고 빈 객체를 준다", async () => {
    await expect(parseErrorBody(jsonResponse("null"))).resolves.toEqual({})
  })

  it("JSON 이 아니면 빈 객체를 준다", async () => {
    await expect(parseErrorBody(jsonResponse("<<not json>>"))).resolves.toEqual({})
  })

  it("본문이 비어 있어도 빈 객체를 준다", async () => {
    await expect(
      parseErrorBody(new Response(null, { status: 500 })),
    ).resolves.toEqual({})
  })

  it("정상 에러 봉투는 message/code 를 준다", async () => {
    await expect(
      parseErrorBody(jsonResponse(JSON.stringify({ message: "안돼요", code: "NO" }))),
    ).resolves.toEqual({ message: "안돼요", code: "NO" })
  })
})
