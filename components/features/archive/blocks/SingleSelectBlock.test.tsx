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

/**
 * FRT-322 — 목록의 **소유권**은 편집 권한과 같은 축이다. 편집을 막았으므로 템플릿 블록은
 * 확정본을 되찾아야 하고(과거 인라인 편집으로 프리셋을 지운 저장값을 되돌릴 UI 가 이제 없다),
 * 커스텀 블록은 반대로 사용자가 지운 옵션이 부활하면 안 된다(FRT-158 그 버그다).
 */
describe("FRT-322 옵션 목록 소유권", () => {
  it("템플릿 블록은 저장값이 반쪽이어도 프리셋 전체를 되찾는다", () => {
    const block = makeBlock()
    render(
      <SingleSelectBlock
        block={{ ...block, value: { type: "single-select", options: ["인턴"], selected: "인턴" } }}
        onChange={() => {}}
      />,
    )
    expect(renderedOptions()).toEqual(OPTIONS)
  })

  it("프리셋에 없는 저장 선택값은 목록 끝에 붙어 살아남는다", () => {
    const block = makeBlock()
    render(
      <SingleSelectBlock
        block={{ ...block, value: { type: "single-select", options: [], selected: "파견직" } }}
        onChange={() => {}}
      />,
    )
    expect(renderedOptions()).toEqual([...OPTIONS, "파견직"])
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("파견직")
  })

  it("커스텀 블록에서 지운 옵션은 되살아나지 않는다", () => {
    const block = makeBlock()
    render(
      <SingleSelectBlock
        block={{ ...block, value: { type: "single-select", options: ["인턴"], selected: "인턴" } }}
        allowOptionEdit
        onChange={() => {}}
      />,
    )
    expect(renderedOptions()).toEqual(["인턴"])
  })

  it("템플릿 프리셋이 없는 블록은 저장 옵션을 그대로 쓴다", () => {
    const block = makeBlock()
    render(
      <SingleSelectBlock
        block={{
          ...block,
          options: undefined,
          value: { type: "single-select", options: ["갑", "을"], selected: "" },
        }}
        onChange={() => {}}
      />,
    )
    expect(renderedOptions()).toEqual(["갑", "을"])
  })
})

/**
 * FRT-322 — 편집을 막으면 프리셋 밖 값을 넣을 길이 사라진다. 확정본이 이미 갖고 있는
 * '기타'가 그 통로가 된다: 고르면 그 자리에서 직접 적고, 적은 값은 `selected` 에
 * **원문 그대로** 저장된다("기타"가 아니라 "항공"). 새 값 필드를 만들지 않으므로
 * selected 문자열만 읽는 소비처(포트폴리오 공개 판정·백엔드 분석)가 전부 무변경이다.
 */
describe("FRT-322 '기타' 직접 입력", () => {
  const OTHER_OPTIONS = ["IT/개발", "디자인", "기타"]

  function makeOtherBlock(selected = ""): Block {
    const block = createSelectField("분야", OTHER_OPTIONS, { allowOther: true })
    return { ...block, value: { ...(block.value as SingleSelectBlockValue), selected } }
  }

  it("allowOther 없이 '기타'를 골라도 입력칸이 열리지 않는다", async () => {
    const user = userEvent.setup()
    render(<SingleSelectBlock block={makeBlock(OTHER_OPTIONS)} onChange={() => {}} />)

    await user.selectOptions(screen.getByRole("combobox"), "기타")

    expect(screen.queryByLabelText("기타 직접 입력")).toBeNull()
  })

  it("allowOther 이면 '기타' 선택 시 입력칸이 열린다", async () => {
    const user = userEvent.setup()
    render(<SingleSelectBlock block={makeOtherBlock()} onChange={() => {}} />)

    await user.selectOptions(screen.getByRole("combobox"), "기타")

    expect(screen.getByLabelText("기타 직접 입력")).toBeDefined()
  })

  it("'기타'를 고른 것만으로는 selected 에 '기타'가 저장되지 않는다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SingleSelectBlock block={makeOtherBlock()} onChange={onChange} />)

    await user.selectOptions(screen.getByRole("combobox"), "기타")

    // '기타'는 값이 아니라 입력 모드다. 그대로 저장되면 분석이 "기타"라는 분야를 읽는다.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ selected: "" }))
  })

  it("입력한 값이 selected 에 원문 그대로 나간다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    function OtherHarness() {
      const [block, setBlock] = useState(() => makeOtherBlock())
      return (
        <SingleSelectBlock
          block={block}
          onChange={value => {
            onChange(value)
            setBlock(prev => ({ ...prev, value }))
          }}
        />
      )
    }
    render(<OtherHarness />)

    await user.selectOptions(screen.getByRole("combobox"), "기타")
    await user.type(screen.getByLabelText("기타 직접 입력"), "항공")

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ selected: "항공" }))
  })

  it("프리셋 밖 저장값은 '기타' 모드로 복원된다 — 목록 끝에 붙지 않는다", () => {
    render(<SingleSelectBlock block={makeOtherBlock("항공")} onChange={() => {}} />)

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("기타")
    expect((screen.getByLabelText("기타 직접 입력") as HTMLInputElement).value).toBe("항공")
    // 같은 값이 목록과 입력칸에 두 번 나오면 어느 쪽이 진짜인지 알 수 없다.
    expect(renderedOptions()).toEqual(OTHER_OPTIONS)
  })

  it("옵션에 '기타'가 없으면 allowOther 를 켜도 아무 일도 없다", async () => {
    const user = userEvent.setup()
    const block = createSelectField("분야", ["IT/개발", "디자인"], { allowOther: true })
    render(<SingleSelectBlock block={block} onChange={() => {}} />)

    await user.selectOptions(screen.getByRole("combobox"), "디자인")

    expect(screen.queryByLabelText("기타 직접 입력")).toBeNull()
  })

  /**
   * 필수 드롭다운에서 '기타'만 고르고 적지 않으면 select 의 값은 "기타"라 브라우저 검증이
   * 통과해 버린다 — 실제 저장값은 빈 문자열인데. 필수를 입력칸이 물려받아야 그 구멍이 막힌다.
   */
  it("필수 필드의 '기타' 입력칸은 필수를 물려받는다", async () => {
    const user = userEvent.setup()
    const base = createSelectField("분야", OTHER_OPTIONS, { allowOther: true, required: true })
    render(<SingleSelectBlock block={base} onChange={() => {}} />)

    await user.selectOptions(screen.getByRole("combobox"), "기타")

    expect((screen.getByLabelText("기타 직접 입력") as HTMLInputElement).required).toBe(true)
    // 모드가 열린 동안 select 는 값을 갖지 않는다 — 필수 판정을 입력칸 하나로 모은다.
    expect((screen.getByRole("combobox") as HTMLSelectElement).required).toBe(false)
  })

  it("allowOther 를 끄면 블록에 키를 남기지 않는다", () => {
    // 템플릿 스냅샷 비교(toEqual)에 잡음이 된다 — quickPick·allowCustomTag 와 같은 규약.
    expect("allowOther" in createSelectField("분야", OTHER_OPTIONS)).toBe(false)
    expect(createSelectField("분야", OTHER_OPTIONS, { allowOther: true }).allowOther).toBe(true)
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
