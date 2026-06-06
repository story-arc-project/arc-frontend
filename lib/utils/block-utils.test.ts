import { describe, expect, it } from "vitest"
import {
  cloneBlock,
  createChecklistField,
  createDateField,
  createFileField,
  createLinkField,
  createPeriodField,
  createSelectField,
  createTagsField,
  createTextField,
  isBlockEmpty,
  validateRequiredBlocks,
} from "@/lib/utils/block-utils"

describe("isBlockEmpty", () => {
  it("새로 만든 빈 블록은 모든 타입에서 empty 다", () => {
    expect(isBlockEmpty(createTextField("t"))).toBe(true)
    expect(isBlockEmpty(createDateField("d"))).toBe(true)
    expect(isBlockEmpty(createPeriodField("p"))).toBe(true)
    expect(isBlockEmpty(createSelectField("s", ["a", "b"]))).toBe(true)
    expect(isBlockEmpty(createChecklistField("c", ["a"]))).toBe(true)
    expect(isBlockEmpty(createTagsField("g"))).toBe(true)
    expect(isBlockEmpty(createLinkField("l"))).toBe(true)
    expect(isBlockEmpty(createFileField("f"))).toBe(true)
  })

  it("text 에 값이 들어가면 empty 가 아니다", () => {
    const t = createTextField("t")
    if (t.value.type === "text") t.value.text = "내용"
    expect(isBlockEmpty(t)).toBe(false)
  })

  it("공백만 있는 text 는 여전히 empty 다", () => {
    const t = createTextField("t")
    if (t.value.type === "text") t.value.text = "   "
    expect(isBlockEmpty(t)).toBe(true)
  })

  it("file 은 fileName·fileId·url 중 하나라도 있으면 채워진 것으로 본다", () => {
    const byName = createFileField("f")
    if (byName.value.type === "file") byName.value.fileName = "a.pdf"
    expect(isBlockEmpty(byName)).toBe(false)

    const byId = createFileField("f")
    if (byId.value.type === "file") byId.value.fileId = "file-1"
    expect(isBlockEmpty(byId)).toBe(false)

    const byUrl = createFileField("f")
    if (byUrl.value.type === "file") byUrl.value.url = "https://x"
    expect(isBlockEmpty(byUrl)).toBe(false)
  })
})

describe("validateRequiredBlocks", () => {
  it("required 이면서 비어 있는 블록만 에러 메시지를 모은다", () => {
    const required = createTextField("이름", { required: true })
    const optionalEmpty = createTextField("별명")
    const requiredFilled = createTextField("학교", { required: true })
    if (requiredFilled.value.type === "text") requiredFilled.value.text = "OO대"

    const errors = validateRequiredBlocks([required, optionalEmpty, requiredFilled])
    expect(errors).toEqual(['"이름" 항목을 입력해주세요.'])
  })

  it("문제가 없으면 빈 배열을 반환한다", () => {
    expect(validateRequiredBlocks([createTextField("별명")])).toEqual([])
  })
})

describe("cloneBlock", () => {
  it("새 id 를 부여하고 값은 깊은 복제한다", () => {
    const original = createTextField("t")
    if (original.value.type === "text") original.value.text = "원본"

    const clone = cloneBlock(original)
    expect(clone.id).not.toBe(original.id)
    expect(clone.label).toBe(original.label)
    expect(clone.value).toEqual(original.value)

    // 깊은 복제이므로 클론 변경이 원본에 영향을 주지 않는다.
    if (clone.value.type === "text") clone.value.text = "변경됨"
    expect(original.value).toMatchObject({ text: "원본" })
  })
})
