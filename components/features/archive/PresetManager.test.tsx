import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import PresetManager from "./PresetManager"
import { samplePreset } from "./__fixtures__/archive.fixtures"

afterEach(cleanup)

function setup() {
  const onRename = vi.fn()
  render(<PresetManager presets={[samplePreset]} onRename={onRename}
    onToggleFavorite={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "이름 변경" }))
  const input = screen.getByDisplayValue(samplePreset.name)
  fireEvent.change(input, { target: { value: "  새 이름  " } })
  return { input, onRename }
}

// Keep keydown and focusout in one React batch: the blur handler still belongs
// to the editing render. jsdom does not automatically blur removed DOM nodes.
function finishThenBlur(input: HTMLElement, key: string) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
  })
}

describe("PresetManager rename", () => {
  it("cancels Escape even when blur arrives before the editing render unmounts", () => {
    const { input, onRename } = setup()
    finishThenBlur(input, "Escape")
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText(samplePreset.name)).toBeInTheDocument()
    expect(input).not.toBeInTheDocument()
  })

  it("saves Enter only once when blur also arrives", () => {
    const { input, onRename } = setup()
    finishThenBlur(input, "Enter")
    expect(onRename).toHaveBeenCalledExactlyOnceWith(samplePreset.id, "새 이름")
    expect(input).not.toBeInTheDocument()
  })

  it("saves trimmed names on blur", () => {
    const { input, onRename } = setup()
    fireEvent.blur(input)
    expect(onRename).toHaveBeenCalledExactlyOnceWith(samplePreset.id, "새 이름")
  })

  it.each(["Enter", "Escape"])("starts a fresh session after %s", key => {
    const { input, onRename } = setup()
    finishThenBlur(input, key)
    onRename.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "이름 변경" }))
    const nextInput = screen.getByDisplayValue(samplePreset.name)
    fireEvent.change(nextInput, { target: { value: "다음 이름" } })
    fireEvent.blur(nextInput)
    expect(onRename).toHaveBeenCalledExactlyOnceWith(samplePreset.id, "다음 이름")
  })

  it("does not save whitespace-only names", () => {
    const { input, onRename } = setup()
    fireEvent.change(input, { target: { value: "   " } })
    finishThenBlur(input, "Enter")
    expect(onRename).not.toHaveBeenCalled()
    expect(input).not.toBeInTheDocument()
  })

  it.each([
    { key: "Enter", isComposing: true },
    { key: "Escape", isComposing: true },
    { key: "Enter", keyCode: 229 },
    { key: "Escape", keyCode: 229 },
  ])("keeps editing for IME $key ($isComposing / $keyCode)", event => {
    const { input, onRename } = setup()
    fireEvent.keyDown(input, event)
    expect(input).toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
    finishThenBlur(input, "Enter")
    expect(onRename).toHaveBeenCalledExactlyOnceWith(samplePreset.id, "새 이름")
  })
})
