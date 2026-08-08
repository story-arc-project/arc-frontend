import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import BlockEditModal, { type BlockEditConfig } from "./BlockEditModal"
import type { BlockType } from "@/types/archive"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

function renderModal(
  blockType: BlockType,
  initialConfig: BlockEditConfig,
  onConfirm = vi.fn(),
) {
  render(
    <BlockEditModal
      open
      blockType={blockType}
      initialConfig={initialConfig}
      onClose={() => {}}
      onConfirm={onConfirm}
    />,
  )
  return onConfirm
}

describe("BlockEditModal 옵션 목록", () => {
  it("단일선택은 옵션이 하나만 남으면 더 지울 수 없다", async () => {
    const user = userEvent.setup()
    renderModal("single-select", { label: "고용 형태", options: ["정규직", "계약직"] })

    await user.click(screen.getAllByRole("button", { name: "옵션 삭제" })[0])

    const last = screen.getByRole("button", { name: "옵션 삭제" }) as HTMLButtonElement
    expect(last.disabled).toBe(true)
  })

  it("단일선택에서 지운 옵션은 확인 시 빠진 채로 전달된다", async () => {
    const user = userEvent.setup()
    const onConfirm = renderModal("single-select", {
      label: "고용 형태",
      options: ["정규직", "계약직"],
    })

    await user.click(screen.getAllByRole("button", { name: "옵션 삭제" })[0])
    await user.click(screen.getByRole("button", { name: "확인" }))

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ options: ["계약직"] }))
  })

  it("체크리스트는 옵션을 전부 지울 수 있고, 그 결과가 빈 목록으로 전달된다", async () => {
    const user = userEvent.setup()
    const onConfirm = renderModal("checklist", {
      label: "참여 형태",
      options: ["온라인", "오프라인"],
    })

    // 지울 수 있는 만큼 계속 지운다 — 체크리스트는 인라인 편집기와 마찬가지로 0개를 허용한다.
    for (let i = 0; i < 2; i += 1) {
      const buttons = screen.queryAllByRole("button", { name: "옵션 삭제" })
      if (buttons.length === 0) break
      await user.click(buttons[0])
    }
    await user.click(screen.getByRole("button", { name: "확인" }))

    // `undefined` 로 넘기면 BlockList 가 truthy 가드에서 갱신을 통째로 건너뛰어
    // 지운 옵션이 그대로 되살아난다(FRT-158 형제 결함).
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ options: [] }))
  })

  it("옵션을 쓰지 않는 타입은 options 를 넘기지 않는다", async () => {
    const user = userEvent.setup()
    const onConfirm = renderModal("text", { label: "한 줄 메모" })

    await user.click(screen.getByRole("button", { name: "확인" }))

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ options: undefined }))
  })
})
