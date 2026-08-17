import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import BinaryChoiceBlock from "./BinaryChoiceBlock"
import BlockRenderer from "./BlockRenderer"
import { createBinaryChoiceField } from "@/lib/utils/block-utils"
import type { Block, SingleSelectBlockValue } from "@/types/archive"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

const PAIR: [string, string] = ["계획을 세운 뒤 실행", "상황에 맞게 유연하게 대응"]

function makeBlock(selected = ""): Block {
  const block = createBinaryChoiceField("실행 방식", PAIR, {
    guide: "각 항목에서 나에게 더 가까운 쪽을 클릭해주세요.",
  })
  return { ...block, value: { ...(block.value as SingleSelectBlockValue), selected } }
}

/**
 * FRT-320 — '나는 누구인가?' ③ 업무 성향의 양자택일 카드.
 * 저장은 single-select value shape 그대로이고 UI 만 두 카드다(mood-tag 패턴).
 */
describe("BinaryChoiceBlock", () => {
  it("두 선택지를 카드 버튼으로 렌더하고 가이드를 보여준다", () => {
    render(<BinaryChoiceBlock block={makeBlock()} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: PAIR[0] })).toBeDefined()
    expect(screen.getByRole("button", { name: PAIR[1] })).toBeDefined()
    expect(screen.getByText("각 항목에서 나에게 더 가까운 쪽을 클릭해주세요.")).toBeDefined()
  })

  it("한쪽을 클릭하면 그 값이 selected 로 실린다 — options 는 그대로", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BinaryChoiceBlock block={makeBlock()} onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: PAIR[1] }))
    expect(onChange).toHaveBeenCalledWith({
      type: "single-select",
      options: PAIR,
      selected: PAIR[1],
    })
  })

  it("선택 상태는 aria-pressed 로 노출된다", () => {
    render(<BinaryChoiceBlock block={makeBlock(PAIR[0])} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: PAIR[0] }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: PAIR[1] }).getAttribute("aria-pressed")).toBe("false")
  })

  /** 전 필드가 선택인 유형이다 — 골랐다가 "둘 다 아니다"로 되돌릴 길이 있어야 한다. */
  it("이미 선택된 쪽을 다시 클릭하면 해제된다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BinaryChoiceBlock block={makeBlock(PAIR[0])} onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: PAIR[0] }))
    expect(onChange).toHaveBeenCalledWith({
      type: "single-select",
      options: PAIR,
      selected: "",
    })
  })

  it("readOnly 는 선택값 텍스트만, 없으면 — 를 보여준다", () => {
    const { unmount } = render(
      <BinaryChoiceBlock block={makeBlock(PAIR[0])} readOnly onChange={() => {}} />,
    )
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(screen.getByText(PAIR[0])).toBeDefined()
    unmount()

    render(<BinaryChoiceBlock block={makeBlock()} readOnly onChange={() => {}} />)
    expect(screen.getByText("—")).toBeDefined()
  })
})

describe("BlockRenderer binary-choice 분기", () => {
  const noop = () => {}

  it("variant 가 binary-choice 면 두 카드로 렌더한다 — 드롭다운 없음", () => {
    render(<BlockRenderer block={makeBlock()} onChange={noop} />)
    expect(screen.getByRole("button", { name: PAIR[0] })).toBeDefined()
    expect(screen.queryByRole("combobox")).toBeNull()
  })

  /**
   * 사용자가 옵션 편집으로 셋 이상을 만든 저장값이면 두 카드로는 그릴 수 없다 —
   * 값이 숨지 않도록 SingleSelectBlock(드롭다운)으로 폴백한다(outcome-list 폴백과 같은 규약).
   */
  it("옵션이 2개가 아니면 SingleSelectBlock 으로 폴백한다", () => {
    const block = makeBlock()
    render(
      <BlockRenderer
        block={{
          ...block,
          value: {
            type: "single-select",
            options: [...PAIR, "제3의 길"],
            selected: "제3의 길",
          },
        }}
        onChange={noop}
      />,
    )
    expect(screen.getByRole("combobox")).toBeDefined()
    expect(screen.queryByRole("button", { name: PAIR[0] })).toBeNull()
  })

  it("저장 options 가 비면 템플릿 프리셋 2개로 두 카드를 그린다", () => {
    const block = makeBlock()
    render(
      <BlockRenderer
        block={{ ...block, value: { type: "single-select", options: [], selected: "" } }}
        onChange={noop}
      />,
    )
    expect(screen.getByRole("button", { name: PAIR[0] })).toBeDefined()
    expect(screen.getByRole("button", { name: PAIR[1] })).toBeDefined()
  })
})
