import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { Block, QuickPickPresetId, TagsBlockValue } from "@/types/archive"
import TagsBlock from "./TagsBlock"
import { createTagsField } from "@/lib/utils/block-utils"

/**
 * FRT-301 — 태그 블록의 상시 여백 제거.
 *
 * chip 영역이 `min-h` 로 항상 공간을 차지해 태그가 없어도 라벨과 입력줄 사이에
 * 빈 줄이 남았다. 태그가 있을 때만 chip 줄을 렌더해, 평소에는 공간이 없다가
 * 태그가 생기면 입력줄이 아래로 내려가게 한다.
 */

function makeBlock(tags: string[]): Block {
  return {
    id: "b1",
    type: "tags",
    label: "사용 스킬",
    value: { type: "tags", tags },
  } as Block
}

// vitest globals:false → testing-library 자동 cleanup 미등록이므로 수동 정리.
afterEach(cleanup)

describe("FRT-301 TagsBlock 빈 상태 여백", () => {
  it("태그가 없으면 라벨과 입력 행 사이에 chip 컨테이너가 렌더되지 않는다", () => {
    render(<TagsBlock block={makeBlock([])} onChange={() => {}} />)

    const input = screen.getByPlaceholderText("태그 입력 후 Enter")
    const root = (input.parentElement as HTMLElement).parentElement as HTMLElement

    // 라벨 + 입력 행뿐 — 빈 chip 줄이 공간을 차지하지 않는다.
    expect(root.children).toHaveLength(2)
  })

  it("태그가 있으면 chip 줄이 입력 행 위에 렌더된다", () => {
    render(<TagsBlock block={makeBlock(["React"])} onChange={() => {}} />)

    const input = screen.getByPlaceholderText("태그 입력 후 Enter")
    const root = (input.parentElement as HTMLElement).parentElement as HTMLElement

    expect(root.children).toHaveLength(3)
    expect(screen.getByRole("button", { name: "React 삭제" })).toBeInTheDocument()
  })

  it("'추가' 버튼으로 태그를 커밋하면 onChange 가 새 태그 배열을 받는다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagsBlock block={makeBlock([])} onChange={onChange} />)

    await user.type(screen.getByPlaceholderText("태그 입력 후 Enter"), "React")
    await user.click(screen.getByRole("button", { name: "추가" }))

    expect(onChange).toHaveBeenCalledWith({ type: "tags", tags: ["React"] })
  })
})

// ─────────────────────────────────────────────────────────────────

function makePickerBlock(tags: string[], quickPick?: QuickPickPresetId): Block {
  const block = createTagsField("산업 / 회사 종류", quickPick ? { quickPick } : undefined)
  return { ...block, value: { type: "tags", tags } }
}

function renderPickerBlock(tags: string[], quickPick?: QuickPickPresetId) {
  const onChange = vi.fn()
  render(<TagsBlock block={makePickerBlock(tags, quickPick)} onChange={onChange} />)
  return { onChange }
}

const openPicker = () => fireEvent.click(screen.getByRole("button", { name: /빠른 선택/ }))

describe("TagsBlock 의 '＋빠른 선택' 픽커 (FRT-130)", () => {
  describe("켜지 않은 블록은 그대로다", () => {
    it("quickPick 이 없으면 빠른 선택 버튼이 아예 없다", () => {
      renderPickerBlock([])
      expect(screen.queryByRole("button", { name: /빠른 선택/ })).toBeNull()
    })

    it("직접 입력 칸은 픽커와 무관하게 계속 동작한다", () => {
      const { onChange } = renderPickerBlock([], "industry")
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "직접 친 산업" } })
      fireEvent.click(screen.getByRole("button", { name: "추가" }))
      expect(onChange).toHaveBeenCalledWith({ type: "tags", tags: ["직접 친 산업"] })
    })
  })

  describe("픽커로 고른 값이 태그가 된다", () => {
    it("고르면 기존 태그 뒤에 붙는다 — 저장 shape 은 tags 배열 그대로다", () => {
      const { onChange } = renderPickerBlock(["스타트업"], "industry")
      openPicker()
      fireEvent.click(screen.getByRole("button", { name: "핀테크" }))
      expect(onChange).toHaveBeenCalledWith({ type: "tags", tags: ["스타트업", "핀테크"] })
    })

    it("이미 고른 항목을 다시 누르면 빠진다 (뱃지 × 와 같은 결과)", () => {
      const { onChange } = renderPickerBlock(["스타트업", "핀테크"], "industry")
      openPicker()
      fireEvent.click(screen.getByRole("button", { name: "스타트업" }))
      expect(onChange).toHaveBeenCalledWith({ type: "tags", tags: ["핀테크"] })
    })

    it("직접 친 값은 픽커로 골라도 지워지지 않는다", () => {
      const { onChange } = renderPickerBlock(["우리회사만의 업종"], "industry")
      openPicker()
      fireEvent.click(screen.getByRole("button", { name: "대기업" }))
      expect(onChange).toHaveBeenCalledWith({
        type: "tags",
        tags: ["우리회사만의 업종", "대기업"],
      })
    })

    it("고른 항목은 오렌지 뱃지로 남고 × 로 개별 삭제된다", () => {
      const { onChange } = renderPickerBlock(["대기업"], "industry")
      fireEvent.click(screen.getByRole("button", { name: "대기업 삭제" }))
      expect(onChange).toHaveBeenCalledWith({ type: "tags", tags: [] })
    })
  })

  describe("담을 그릇이 안 맞으면 픽커를 켜지 않는다", () => {
    it("단일 선택 프리셋이 붙어 있으면 픽커 없이 자유 입력만 남는다", () => {
      // tags 는 여러 값을 담는 칸이라 단일 선택 프리셋과 짝이 안 맞는다. 이때 화면이 죽거나
      // 입력이 막히는 대신 기존 UI 로 폴백한다 — 값을 못 넣게 되는 쪽이 더 나쁘다.
      renderPickerBlock([], "job-function")
      expect(screen.queryByRole("button", { name: /빠른 선택/ })).toBeNull()
      expect(screen.getByRole("textbox")).toBeTruthy()
    })

    it("모르는 프리셋 id 여도 자유 입력은 살아 있다", () => {
      const block = { ...makePickerBlock([]), quickPick: "나중에-생길-프리셋" as QuickPickPresetId }
      const onChange = vi.fn()
      render(<TagsBlock block={block} onChange={onChange} />)
      expect(screen.queryByRole("button", { name: /빠른 선택/ })).toBeNull()
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "그래도 입력" } })
      fireEvent.click(screen.getByRole("button", { name: "추가" }))
      expect(onChange).toHaveBeenCalledWith({ type: "tags", tags: ["그래도 입력"] })
    })
  })

  it("readOnly 에는 픽커가 붙지 않는다", () => {
    const value: TagsBlockValue = { type: "tags", tags: ["대기업"] }
    render(
      <TagsBlock block={{ ...makePickerBlock([], "industry"), value }} readOnly onChange={vi.fn()} />,
    )
    expect(screen.queryByRole("button", { name: /빠른 선택/ })).toBeNull()
    expect(screen.getByText("대기업")).toBeTruthy()
  })
})
