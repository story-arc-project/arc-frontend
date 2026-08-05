import { describe, it, expect } from "vitest"
import { canHideBlock, resolveHiddenBlocks, normalizeHiddenKeys } from "@/lib/utils/hidden-fields"
import type { Block } from "@/types/archive"

function block(key: string | undefined, opts: { required?: boolean; text?: string } = {}): Block {
  return {
    id: `id-${key ?? "nokey"}`,
    key,
    type: "text",
    label: key ?? "사용자 블록",
    required: opts.required,
    value: { type: "text", text: opts.text ?? "" },
  }
}

/** 빈 행 하나만 있는 repeatable-cell — isBlockEmpty 는 이걸 empty 로 본다(FRT-122). */
function emptyTableBlock(key: string, opts: { requiredColumn?: boolean } = {}): Block {
  return {
    id: `id-${key}`,
    key,
    type: "repeatable-cell",
    label: key,
    value: {
      type: "repeatable-cell",
      columns: [{ key: "c1", label: "항목", blockType: "text", required: opts.requiredColumn }],
      rows: [{ id: "r1", cells: { c1: "" } }],
    },
  }
}

describe("canHideBlock", () => {
  it("빈 + 선택 + 안정키 있는 블록만 숨길 수 있다", () => {
    expect(canHideBlock(block("detail.배운 점"))).toBe(true)
  })

  it("값이 있으면 숨길 수 없다 — 화면에 없는 값은 손실과 구분되지 않는다", () => {
    expect(canHideBlock(block("detail.배운 점", { text: "많이 배웠다" }))).toBe(false)
  })

  it("필수 필드는 숨길 수 없다", () => {
    expect(canHideBlock(block("basic.경험명", { required: true }))).toBe(false)
  })

  it("안정키 없는 사용자 블록은 대상이 아니다 — 이미 삭제 버튼이 있다", () => {
    expect(canHideBlock(block(undefined))).toBe(false)
  })

  it("빈 행 하나뿐인 표도 비어 있으므로 숨길 수 있다", () => {
    expect(canHideBlock(emptyTableBlock("repeat.프로젝트 기록"))).toBe(true)
  })

  /**
   * `isBlockEmpty` 는 링크를 `url` 로만 판정한다 — 상세뷰에서 URL 없는 링크를 안 그리려는 기준이라
   * 그 자체로는 옳다. 하지만 LinkBlock 은 URL 없이도 제목·유형·설명을 칠 수 있게 해서, 그 상태로
   * 숨기면 **화면엔 없는데 저장 payload 엔 남는다** — 이 기능이 막으려던 무음 잔존 그대로다.
   */
  it("URL 없이 제목만 친 링크는 숨길 수 없다 — 값이 조용히 남는다", () => {
    const block: Block = {
      id: "id-link", key: "detail.공식 URL", type: "link", label: "공식 URL",
      value: { type: "link", url: "", title: "우리 팀 노션", description: "", linkType: "" },
    }
    expect(canHideBlock(block)).toBe(false)
  })

  it("아무것도 안 친 링크는 숨길 수 있다", () => {
    const block: Block = {
      id: "id-link", key: "detail.공식 URL", type: "link", label: "공식 URL",
      value: { type: "link", url: "", title: "", description: "", linkType: "" },
    }
    expect(canHideBlock(block)).toBe(true)
  })

  /**
   * 첨부 블록은 **값이 비어 보이는 순간에도 사용자가 이미 한 일이 있을 수 있다** — 파일을 고른 뒤
   * 업로드가 끝나기 전까지 블록 값은 그대로 비어 있는데, 이때 숨기면 FileBlock 이 언마운트되며
   * `useFileUpload` 가 요청을 abort 하고 결과도 버려 **고른 파일이 조용히 사라진다**.
   * "비었다"는 판정을 첨부 블록에서는 신뢰할 수 없으므로 통째로 제외한다.
   */
  it("파일 블록은 비어 있어도 숨길 수 없다 — 업로드 중 언마운트가 파일을 삼킨다", () => {
    const block: Block = {
      id: "id-file", key: "evidence.증빙 자료", type: "file", label: "증빙 자료",
      value: { type: "file", fileName: "", description: "", evidenceType: "" },
    }
    expect(canHideBlock(block)).toBe(false)
  })

  it("파일 열을 가진 표도 제외한다 — 사용자가 열 유형을 파일로 바꾼 경우", () => {
    const block: Block = {
      id: "id-t", key: "repeat.결과물", type: "repeatable-cell", label: "결과물",
      value: {
        type: "repeatable-cell",
        columns: [{ key: "c1", label: "파일", blockType: "file" }],
        rows: [{ id: "r1", cells: { c1: "" } }],
      },
    }
    expect(canHideBlock(block)).toBe(false)
  })

  /**
   * 표의 필수는 블록이 아니라 **컬럼**에 붙는다(설계/결정·작업 기록·세부 계획 등 18유형 중 13개).
   * `block.required` 만 보면 진행도 바가 필수로 세는 표를 사용자가 치울 수 있게 되어,
   * "필수인데 화면에 없는" 상태가 만들어진다. 판정은 `isRequiredBlock` 한 곳으로 모은다.
   */
  it("필수 컬럼을 가진 표는 블록이 optional 이어도 숨길 수 없다", () => {
    expect(canHideBlock(emptyTableBlock("repeat.설계/결정", { requiredColumn: true }))).toBe(false)
  })
})

describe("resolveHiddenBlocks", () => {
  it("hidden 키의 빈 선택 블록을 hidden 으로 가른다", () => {
    const blocks = [block("a"), block("b"), block("c")]
    const r = resolveHiddenBlocks(blocks, ["b"])
    expect(r.visible.map(b => b.key)).toEqual(["a", "c"])
    expect(r.hidden.map(b => b.key)).toEqual(["b"])
  })

  it("원래 순서를 보존한다", () => {
    const blocks = [block("a"), block("b"), block("c"), block("d")]
    const r = resolveHiddenBlocks(blocks, ["c", "a"])
    expect(r.visible.map(b => b.key)).toEqual(["b", "d"])
    expect(r.hidden.map(b => b.key)).toEqual(["a", "c"])
  })

  it("hidden 키인데 값이 생겼으면 자동으로 다시 보인다", () => {
    const blocks = [block("a", { text: "다른 기기에서 입력됨" })]
    const r = resolveHiddenBlocks(blocks, ["a"])
    expect(r.visible.map(b => b.key)).toEqual(["a"])
    expect(r.hidden).toEqual([])
  })

  it("hidden 키인데 필수가 됐으면 강제로 다시 보인다", () => {
    const blocks = [block("a", { required: true })]
    const r = resolveHiddenBlocks(blocks, ["a"])
    expect(r.visible.map(b => b.key)).toEqual(["a"])
    expect(r.hidden).toEqual([])
  })

  it("hidden 키인데 컬럼이 필수가 됐으면 강제로 다시 보인다 — 템플릿 개편 대비", () => {
    const blocks = [emptyTableBlock("repeat.기록", { requiredColumn: true })]
    const r = resolveHiddenBlocks(blocks, ["repeat.기록"])
    expect(r.visible.map(b => b.key)).toEqual(["repeat.기록"])
    expect(r.hidden).toEqual([])
  })

  it("템플릿에 없는 orphan 키는 아무 블록도 숨기지 않는다", () => {
    const blocks = [block("a"), block("b")]
    const r = resolveHiddenBlocks(blocks, ["없는키", "b"])
    expect(r.visible.map(b => b.key)).toEqual(["a"])
    expect(r.hidden.map(b => b.key)).toEqual(["b"])
  })

  it("hiddenKeys 가 비면 전부 보인다", () => {
    const blocks = [block("a"), block("b")]
    expect(resolveHiddenBlocks(blocks, []).visible).toHaveLength(2)
    expect(resolveHiddenBlocks(blocks, []).hidden).toEqual([])
  })

  it("안정키 없는 블록은 숨겨지지 않는다", () => {
    const blocks = [block(undefined), block("a")]
    const r = resolveHiddenBlocks(blocks, ["a"])
    expect(r.visible.map(b => b.label)).toEqual(["사용자 블록"])
    expect(r.hidden.map(b => b.key)).toEqual(["a"])
  })
})

describe("normalizeHiddenKeys", () => {
  it("값이 생긴 키를 뺀다 — 자동 복귀를 저장에도 반영해야 다음 로드에 또 숨지 않는다", () => {
    const blocks = [block("a", { text: "값" }), block("b")]
    expect(normalizeHiddenKeys(blocks, ["a", "b"])).toEqual(["b"])
  })

  it("필수가 된 키를 뺀다", () => {
    const blocks = [block("a", { required: true }), block("b")]
    expect(normalizeHiddenKeys(blocks, ["a", "b"])).toEqual(["b"])
  })

  it("필수 컬럼이 생긴 표의 키를 뺀다", () => {
    const blocks = [emptyTableBlock("repeat.기록", { requiredColumn: true }), block("b")]
    expect(normalizeHiddenKeys(blocks, ["repeat.기록", "b"])).toEqual(["b"])
  })

  it("모르는 키는 건드리지 않는다 — dedup 으로 카드에서 빠진 블록의 숨김을 잃지 않는다", () => {
    const blocks = [block("a")]
    expect(normalizeHiddenKeys(blocks, ["a", "다른유형키"])).toEqual(["a", "다른유형키"])
  })

  it("중복 키를 한 번만 남긴다", () => {
    const blocks = [block("a")]
    expect(normalizeHiddenKeys(blocks, ["a", "a"])).toEqual(["a"])
  })

  it("입력 배열을 변형하지 않는다", () => {
    const blocks = [block("a", { text: "값" })]
    const keys = ["a", "b"]
    normalizeHiddenKeys(blocks, keys)
    expect(keys).toEqual(["a", "b"])
  })
})
