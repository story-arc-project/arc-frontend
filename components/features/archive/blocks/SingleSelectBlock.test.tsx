import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import SingleSelectBlock from "./SingleSelectBlock"
import { createSelectField } from "@/lib/utils/block-utils"
import type { Block, SingleSelectBlockValue } from "@/types/archive"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

const OPTIONS = ["정규직", "계약직", "인턴", "프리랜서"]

function makeBlock(options: string[] = OPTIONS, selected = ""): Block {
  const block = createSelectField("고용 형태", options)
  return { ...block, value: { ...(block.value as SingleSelectBlockValue), selected } }
}

/**
 * 부모가 값을 소유하는 controlled 사용을 재현한다. FRT-158 의 부활 버그는 `onChange` 결과가
 * 다시 `block.value` 로 돌아와 재렌더될 때만 드러나므로(폴백이 매 렌더 재계산된다),
 * onChange 를 spy 로만 받는 테스트로는 잡히지 않는다.
 */
function Harness({
  initial = OPTIONS,
  selected = "",
  allowOptionEdit,
}: {
  initial?: string[]
  selected?: string
  allowOptionEdit?: boolean
}) {
  const [block, setBlock] = useState(() => makeBlock(initial, selected))
  return (
    <SingleSelectBlock
      block={block}
      allowOptionEdit={allowOptionEdit}
      onChange={value => setBlock(prev => ({ ...prev, value }))}
    />
  )
}

/** 드롭다운에 실제로 실린 선택지(안내문 "선택해주세요" 제외). */
function renderedOptions(): string[] {
  return Array.from(screen.getByRole("combobox").querySelectorAll("option"))
    .map(o => o.textContent ?? "")
    .filter(t => t !== "선택해주세요")
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "옵션 편집" }))
}

/**
 * FRT-322 — 인라인 옵션 편집은 **커스텀 블록에만** 남는다. 템플릿이 소유한 확정본 선택지를
 * 사용자가 고칠 수 있으면 기획이 정한 목록이 계정마다 갈린다. 판정은 새로 만들지 않고
 * `BlockList` 의 `editEnabled`(커스텀 블록인가)를 그대로 받는다.
 */
describe("FRT-322 옵션 편집 노출", () => {
  it("템플릿 블록(기본값)에는 옵션 편집 토글이 없다", () => {
    render(<SingleSelectBlock block={makeBlock()} onChange={() => {}} />)
    expect(screen.queryByRole("button", { name: "옵션 편집" })).toBeNull()
  })

  it("커스텀 블록(allowOptionEdit)에는 옵션 편집 토글이 있다", () => {
    render(<SingleSelectBlock block={makeBlock()} allowOptionEdit onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "옵션 편집" })).toBeDefined()
  })

  it("템플릿 블록이어도 드롭다운으로 값은 고를 수 있다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SingleSelectBlock block={makeBlock()} onChange={onChange} />)

    await user.selectOptions(screen.getByRole("combobox"), "인턴")

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ selected: "인턴" }))
  })
})

describe("SingleSelectBlock 옵션 편집", () => {
  it("옵션이 2개 이상이면 삭제한 옵션이 드롭다운에서 빠진다", async () => {
    const user = userEvent.setup()
    render(<Harness allowOptionEdit initial={["정규직", "계약직"]} />)
    await openEditor(user)

    await user.click(screen.getAllByRole("button", { name: "옵션 삭제" })[0])

    expect(renderedOptions()).toEqual(["계약직"])
  })

  it("지운 옵션이 선택돼 있었으면 선택을 비운다", async () => {
    const user = userEvent.setup()
    render(<Harness allowOptionEdit initial={["정규직", "계약직"]} selected="정규직" />)
    await openEditor(user)

    await user.click(screen.getAllByRole("button", { name: "옵션 삭제" })[0])

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("")
  })

  it("옵션이 하나만 남으면 더 지울 수 없다 — 삭제 버튼이 비활성이다", async () => {
    const user = userEvent.setup()
    render(<Harness allowOptionEdit initial={["정규직", "계약직"]} />)
    await openEditor(user)

    await user.click(screen.getAllByRole("button", { name: "옵션 삭제" })[0])

    const lastRemove = screen.getByRole("button", { name: "옵션 삭제" }) as HTMLButtonElement
    expect(lastRemove.disabled).toBe(true)
  })

  it("옵션을 전부 지우려 해도 지웠던 원래 목록이 되살아나지 않는다", async () => {
    const user = userEvent.setup()
    render(<Harness allowOptionEdit />)
    await openEditor(user)

    // 남아 있는 삭제 버튼을 계속 누른다 — 가드가 없으면 마지막 삭제에서 목록이 통째로 부활한다.
    for (let i = 0; i < OPTIONS.length; i += 1) {
      const buttons = screen.getAllByRole("button", { name: "옵션 삭제" })
      const enabled = buttons.filter(b => !(b as HTMLButtonElement).disabled)
      if (enabled.length === 0) break
      await user.click(enabled[0])
    }

    const remaining = renderedOptions()
    expect(remaining).toHaveLength(1)
    expect(remaining).not.toEqual(OPTIONS)
  })

  it("마지막 옵션이 남았을 때 삭제를 눌러도 onChange 가 불리지 않는다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SingleSelectBlock block={makeBlock(["정규직"])} allowOptionEdit onChange={onChange} />)
    await openEditor(user)

    await user.click(screen.getByRole("button", { name: "옵션 삭제" }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it("하나 남은 옵션도 이름은 바꿀 수 있다 — 되돌릴 길이 막히지 않는다", async () => {
    const user = userEvent.setup()
    render(<Harness allowOptionEdit initial={["정규직"]} />)
    await openEditor(user)

    await user.click(screen.getByRole("button", { name: "옵션 수정" }))
    const input = screen.getByDisplayValue("정규직")
    await user.clear(input)
    await user.type(input, "파견직")
    await user.click(screen.getByRole("button", { name: "확인" }))

    expect(renderedOptions()).toEqual(["파견직"])
  })
})

/**
 * FRT-172 — 이름 편집처럼 Enter·Escape 를 함께 다루는 핸들러는 헬퍼로 감쌀 수 없어
 * `isImeComposing` 가드만 맨 앞에 둔다. 그 갈래도 실물로 증명해 둔다.
 */
describe("FRT-172 옵션 이름 편집 중 IME 조합", () => {
  async function startRename(user: ReturnType<typeof userEvent.setup>) {
    render(<Harness allowOptionEdit initial={["정규직", "계약직"]} />)
    await openEditor(user)
    await user.click(screen.getAllByRole("button", { name: "옵션 수정" })[0])
    const input = screen.getByDisplayValue("정규직")
    await user.clear(input)
    await user.type(input, "파견직")
    return input
  }

  it("조합 중 Enter 는 이름 편집을 확정하지 않는다", async () => {
    const user = userEvent.setup()
    const input = await startRename(user)

    fireEvent.keyDown(input, { key: "Enter", isComposing: true })

    // 목록을 먼저 단언한다 — combobox 는 항상 있으므로 가드가 빠지면 "찾지 못함"이 아니라
    // "단언 실패"로 떨어져 셀렉터 오타와 구별된다.
    expect(renderedOptions()).toEqual(["정규직", "계약직"])
    // 편집 창도 그대로 열려 있다.
    expect(screen.getByDisplayValue("파견직")).toBeInTheDocument()
  })

  it("조합이 끝난 Enter 는 이름 편집을 확정한다", async () => {
    const user = userEvent.setup()
    const input = await startRename(user)

    fireEvent.keyDown(input, { key: "Enter" })

    expect(renderedOptions()).toEqual(["파견직", "계약직"])
  })
})
