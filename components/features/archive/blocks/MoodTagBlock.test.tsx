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
 * FRT-320 — '나는 누구인가?' ① 키워드 태그의 "직접 추가 가능".
 *
 * `allowCustomTag` 는 템플릿 전용 opt-in 이다(variant·lockColumns 규약). 핵심 불변식 둘:
 *  · 플래그가 없으면 입력줄 자체가 렌더되지 않는다 — 기존 12개 유형의 무드 태그가
 *    이 확장의 영향권에 들지 않는다(위 "버튼을 두지 않는다" 단언과 한 쌍인 회귀 그물).
 *  · 새 태그는 `options`(프리셋)에 넣지 않고 `checked` 에만 넣는다 — 다음 렌더는
 *    `moodTagOptions()` 의 기존 "checked 에만 남은 값도 뒤에 붙인다" 폴백이 그려 준다.
 */
describe("MoodTagBlock 직접 추가 (allowCustomTag)", () => {
  function makeCustomBlock(checked: string[] = []): Block {
    const block = createMoodTagField("나를 표현하는 키워드", TAGS, { allowCustomTag: true })
    return { ...block, value: { ...(block.value as ChecklistBlockValue), checked } }
  }

  it("플래그가 없으면 입력줄이 렌더되지 않는다 — 기존 유형 동작 불변", () => {
    render(<MoodTagBlock block={makeBlock()} onChange={() => {}} />)
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("입력 후 추가하면 options 는 그대로, checked 에만 태그가 붙는다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MoodTagBlock block={makeCustomBlock()} onChange={onChange} />)

    await user.type(screen.getByRole("textbox"), "정리 덕후")
    await user.click(screen.getByRole("button", { name: "직접 추가" }))
    expect(onChange).toHaveBeenCalledWith({
      type: "checklist",
      options: TAGS,
      checked: ["정리 덕후"],
    })
  })

  it("이미 선택된 태그와 같은 텍스트는 다시 추가하지 않는다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MoodTagBlock block={makeCustomBlock(["정리 덕후"])} onChange={onChange} />)

    await user.type(screen.getByRole("textbox"), "정리 덕후")
    await user.click(screen.getByRole("button", { name: "직접 추가" }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("추가된 커스텀 태그는 다음 렌더에서 pill 로 보이고 해제할 수 있다", async () => {
    const user = userEvent.setup()
    function CustomHarness() {
      const [block, setBlock] = useState(() => makeCustomBlock())
      return (
        <MoodTagBlock block={block} onChange={value => setBlock(prev => ({ ...prev, value }))} />
      )
    }
    render(<CustomHarness />)

    await user.type(screen.getByRole("textbox"), "정리 덕후")
    await user.click(screen.getByRole("button", { name: "직접 추가" }))

    const added = screen.getByRole("checkbox", { name: "정리 덕후" }) as HTMLInputElement
    expect(added.checked).toBe(true)
    // 해제해도 pill 은 남는다 — 토글이 계산된 목록을 options 로 저장하는 기존 규약 그대로라,
    // 한 번 추가한 태그는 프리셋처럼 다시 고를 수 있다.
    await user.click(added)
    expect(
      (screen.getByRole("checkbox", { name: "정리 덕후" }) as HTMLInputElement).checked,
    ).toBe(false)
  })

  it("readOnly 에는 입력줄이 없다", () => {
    render(<MoodTagBlock block={makeCustomBlock(["정리 덕후"])} readOnly onChange={() => {}} />)
    expect(screen.queryByRole("textbox")).toBeNull()
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
