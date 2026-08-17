import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { Block } from "@/types/archive"
import TagsBlock from "./TagsBlock"

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
