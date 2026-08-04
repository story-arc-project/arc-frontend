import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import MoodTagBlock from "./MoodTagBlock"
import BlockRenderer from "./BlockRenderer"
import { createMoodTagField } from "@/lib/utils/block-utils"
import type { Block, ChecklistBlockValue } from "@/types/archive"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

const TAGS = ["🎨 창의적 표현", "🤝 팀 협업", "🔥 도전적"]

function makeBlock(checked: string[] = []): Block {
  const block = createMoodTagField("활동 성격", TAGS, { guide: "여러 개 선택할 수 있어요." })
  return { ...block, value: { ...(block.value as ChecklistBlockValue), checked } }
}

/** 부모가 값을 소유하는 controlled 사용을 재현한다(선택이 누적되도록). */
function Harness({ initial = [] }: { initial?: string[] }) {
  const [block, setBlock] = useState(() => makeBlock(initial))
  return (
    <MoodTagBlock
      block={block}
      onChange={value => setBlock(prev => ({ ...prev, value }))}
    />
  )
}

describe("MoodTagBlock", () => {
  it("프리셋 태그를 전부 렌더하고 가이드를 보여준다", () => {
    render(<MoodTagBlock block={makeBlock()} onChange={() => {}} />)
    for (const tag of TAGS) {
      expect(screen.getByRole("checkbox", { name: tag })).toBeDefined()
    }
    expect(screen.getByText("여러 개 선택할 수 있어요.")).toBeDefined()
  })

  it("여러 태그를 선택하고 다시 눌러 해제할 수 있다", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole("checkbox", { name: "🤝 팀 협업" }))
    await user.click(screen.getByRole("checkbox", { name: "🔥 도전적" }))
    expect((screen.getByRole("checkbox", { name: "🤝 팀 협업" }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole("checkbox", { name: "🔥 도전적" }) as HTMLInputElement).checked).toBe(true)

    await user.click(screen.getByRole("checkbox", { name: "🤝 팀 협업" }))
    expect((screen.getByRole("checkbox", { name: "🤝 팀 협업" }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole("checkbox", { name: "🔥 도전적" }) as HTMLInputElement).checked).toBe(true)
  })

  it("options 는 건드리지 않고 checked 만 바꾼다 (프리셋 보존)", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MoodTagBlock block={makeBlock()} onChange={onChange} />)

    await user.click(screen.getByRole("checkbox", { name: "🎨 창의적 표현" }))
    expect(onChange).toHaveBeenCalledWith({
      type: "checklist",
      options: TAGS,
      checked: ["🎨 창의적 표현"],
    })
  })

  it("프리셋 태그를 지우는 버튼을 두지 않는다 (되돌릴 방법이 없기 때문)", () => {
    render(<MoodTagBlock block={makeBlock(["🤝 팀 협업"])} onChange={() => {}} />)
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  it("readOnly 는 선택된 태그만 보여주고, 없으면 — 를 보여준다", () => {
    const { unmount } = render(
      <MoodTagBlock block={makeBlock(["🤝 팀 협업"])} readOnly onChange={() => {}} />,
    )
    expect(screen.getByText("🤝 팀 협업")).toBeDefined()
    expect(screen.queryByText("🔥 도전적")).toBeNull()
    unmount()

    render(<MoodTagBlock block={makeBlock()} readOnly onChange={() => {}} />)
    expect(screen.getByText("—")).toBeDefined()
  })
})

describe("BlockRenderer mood-tag 분기", () => {
  const noop = () => {}

  it("variant 가 mood-tag 면 알약 태그로 렌더한다 (옵션 추가 UI 없음)", () => {
    render(<BlockRenderer block={makeBlock()} onChange={noop} />)
    expect(screen.getByRole("checkbox", { name: "🎨 창의적 표현" })).toBeDefined()
    expect(screen.queryByPlaceholderText("항목 추가...")).toBeNull()
  })

  it("저장 options 가 비면 템플릿 프리셋으로 복원해 그대로 알약을 그린다", () => {
    const empty = makeBlock()
    render(
      <BlockRenderer
        block={{ ...empty, value: { type: "checklist", options: [], checked: [] } }}
        onChange={noop}
      />,
    )
    expect(screen.getByRole("checkbox", { name: "🎨 창의적 표현" })).toBeDefined()
    expect(screen.queryByPlaceholderText("항목 추가...")).toBeNull()
  })

  it("그릴 태그를 하나도 못 구하면 옵션을 만들 수 있는 ChecklistBlock 으로 폴백한다", () => {
    const empty = makeBlock()
    render(
      <BlockRenderer
        block={{ ...empty, options: undefined, value: { type: "checklist", options: [], checked: [] } }}
        onChange={noop}
      />,
    )
    // ChecklistBlock 만 옵션 추가 입력을 갖는다 — 폴백이 걸렸다는 신호.
    expect(screen.getByPlaceholderText("항목 추가...")).toBeDefined()
  })
})

/**
 * 손상·개편된 저장값 방어. 선택돼 있는데 화면에 안 보이면 해제할 방법이 사라진다.
 */
describe("MoodTagBlock 손상값 복원", () => {
  it("options 키가 아예 없어도 크래시하지 않고 프리셋으로 그린다", () => {
    const block = {
      ...makeBlock(),
      value: { type: "checklist", checked: ["🤝 팀 협업"] } as unknown as ChecklistBlockValue,
    }
    render(<MoodTagBlock block={block} onChange={() => {}} />)
    expect(
      (screen.getByRole("checkbox", { name: "🤝 팀 협업" }) as HTMLInputElement).checked,
    ).toBe(true)
  })

  it("프리셋에 없는 checked 값도 보여주고 해제할 수 있다 (프리셋 개편 대비)", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const block = {
      ...makeBlock(),
      value: { type: "checklist" as const, options: [], checked: ["🛰️ 폐기된 태그"] },
    }
    render(<MoodTagBlock block={block} onChange={onChange} />)

    const stale = screen.getByRole("checkbox", { name: "🛰️ 폐기된 태그" }) as HTMLInputElement
    expect(stale.checked).toBe(true)
    await user.click(stale)
    expect(onChange).toHaveBeenCalledWith({
      type: "checklist",
      options: [...TAGS, "🛰️ 폐기된 태그"],
      checked: [],
    })
  })
})
