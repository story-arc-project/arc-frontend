import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

import TextBlock from "./TextBlock"
import { createTextField } from "@/lib/utils/block-utils"
import type { Block, QuickPickPresetId } from "@/types/archive"

afterEach(cleanup)

function makeBlock(text: string, quickPick?: QuickPickPresetId): Block {
  const block = createTextField("직무 / 포지션", {
    required: true,
    placeholder: "예: 브랜드 마케팅 인턴",
    ...(quickPick ? { quickPick } : {}),
  })
  return { ...block, value: { type: "text", text } }
}

function renderBlock(text: string, quickPick?: QuickPickPresetId) {
  const onChange = vi.fn()
  render(<TextBlock block={makeBlock(text, quickPick)} onChange={onChange} />)
  return { onChange }
}

const openPicker = () => fireEvent.click(screen.getByRole("button", { name: /빠른 선택/ }))

describe("TextBlock 의 '＋빠른 선택' 픽커 (FRT-130)", () => {
  it("quickPick 이 없으면 버튼이 없고 기존 입력칸만 남는다", () => {
    renderBlock("")
    expect(screen.queryByRole("button", { name: /빠른 선택/ })).toBeNull()
    expect(screen.getByRole("textbox")).toBeTruthy()
  })

  it("고르면 그 값이 입력칸 값이 된다 — 저장 shape 은 text 문자열 그대로다", () => {
    const { onChange } = renderBlock("", "job-function")
    openPicker()
    fireEvent.click(screen.getByRole("button", { name: "브랜드 마케팅" }))
    expect(onChange).toHaveBeenCalledWith({ type: "text", text: "브랜드 마케팅" })
  })

  it("이미 값이 있으면 고른 값으로 대체된다 — 단일 값 칸이라 누적하지 않는다", () => {
    const { onChange } = renderBlock("서비스 기획", "job-function")
    openPicker()
    fireEvent.click(screen.getByRole("button", { name: "PM/PO" }))
    expect(onChange).toHaveBeenCalledWith({ type: "text", text: "PM/PO" })
  })

  it("현재 값과 같은 항목은 눌린 상태로 보인다", () => {
    renderBlock("PM/PO", "job-function")
    openPicker()
    expect(screen.getByRole("button", { name: "PM/PO" })).toHaveAttribute("aria-pressed", "true")
  })

  it("픽커에 없는 직무를 직접 쳐도 그대로 저장된다", () => {
    const { onChange } = renderBlock("", "job-function")
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "리서치 인턴" } })
    expect(onChange).toHaveBeenCalledWith({ type: "text", text: "리서치 인턴" })
  })

  describe("담을 그릇이 안 맞으면 픽커를 켜지 않는다", () => {
    it("다중 선택 프리셋이 붙어 있으면 픽커가 안 뜬다", () => {
      // text 는 값이 하나뿐이라 다중 선택을 태우면 고를 때마다 앞 값이 조용히 지워진다.
      renderBlock("", "industry")
      expect(screen.queryByRole("button", { name: /빠른 선택/ })).toBeNull()
    })

    it("모르는 프리셋 id 여도 직접 입력은 살아 있다", () => {
      const block = { ...makeBlock(""), quickPick: "나중에-생길-프리셋" as QuickPickPresetId }
      const onChange = vi.fn()
      render(<TextBlock block={block} onChange={onChange} />)
      expect(screen.queryByRole("button", { name: /빠른 선택/ })).toBeNull()
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "그래도 입력" } })
      expect(onChange).toHaveBeenCalledWith({ type: "text", text: "그래도 입력" })
    })
  })

  it("readOnly 에는 픽커가 붙지 않는다", () => {
    render(<TextBlock block={makeBlock("PM/PO", "job-function")} readOnly onChange={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /빠른 선택/ })).toBeNull()
    expect(screen.getByText("PM/PO")).toBeTruthy()
  })
})
