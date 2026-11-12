import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import LibraryDropdown from "./LibraryDropdown"
import { systemLibrary, customLibrary, uncoloredLibrary } from "./__fixtures__/archive.fixtures"

afterEach(cleanup)

function setup() {
  const props = {
    libraries: [systemLibrary, customLibrary, uncoloredLibrary],
    activeLibraryId: systemLibrary.id,
    experiences: [],
    onSelectLibrary: vi.fn(),
    onCreateLibrary: vi.fn(),
    onRenameLibrary: vi.fn(),
    onDeleteLibrary: vi.fn(),
    onUpdateLibraryColor: vi.fn(),
  }
  const view = render(<LibraryDropdown {...props} />)
  const trigger = screen.getByRole("button", { expanded: false })
  async function request(name = customLibrary.name) {
    await userEvent.click(trigger)
    const row = screen.getByText(name).closest('[role="button"]') as HTMLElement
    await userEvent.click(within(row).getByRole("button", { name: "삭제" }))
  }
  return { props, view, trigger, request }
}

describe("library deletion confirmation", () => {
  it.each(["button", "Escape", "backdrop"])("cancels with %s without deleting or selecting", async method => {
    const { props, trigger, request } = setup()
    await request()
    const dialog = screen.getByRole("dialog", { name: "라이브러리 삭제" })
    expect(within(dialog).getByText(customLibrary.name)).toBeInTheDocument()
    expect(document.querySelector("[data-archive-popover]")).toBeNull()
    expect(props.onDeleteLibrary).not.toHaveBeenCalled()
    if (method === "button") await userEvent.click(within(dialog).getByRole("button", { name: "취소" }))
    else if (method === "Escape") await userEvent.keyboard("{Escape}")
    else fireEvent.click(dialog.parentElement!)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(props.onDeleteLibrary).not.toHaveBeenCalled()
    expect(props.onSelectLibrary).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
  })

  it("confirms clicked target once with duplicate clicks", async () => {
    const { props, request } = setup()
    await request(uncoloredLibrary.name)
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" })
    props.onDeleteLibrary.mockImplementation(() => fireEvent.click(confirm))
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(props.onDeleteLibrary).toHaveBeenCalledExactlyOnceWith(uncoloredLibrary.id)
    expect(props.onSelectLibrary).not.toHaveBeenCalled()
  })

  it("supports keyboard confirmation", async () => {
    const { props, request } = setup()
    await request()
    within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }).focus()
    await userEvent.keyboard("{Enter}{Enter}")
    expect(props.onDeleteLibrary).toHaveBeenCalledExactlyOnceWith(customLibrary.id)
  })

  it.each(["missing", "system"])("suppresses pending %s target", async state => {
    const { props, view, request } = setup()
    await request()
    view.rerender(<LibraryDropdown {...props} libraries={state === "missing" ? [systemLibrary] : [systemLibrary, { ...customLibrary, isSystem: true }]} />)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(props.onDeleteLibrary).not.toHaveBeenCalled()
  })

  it("preserves selection, rename, and system protection", async () => {
    const { props, trigger } = setup()
    await userEvent.click(trigger)
    const systemRow = screen.getByText(systemLibrary.name, { selector: "span.flex-1" }).closest('[role="button"]') as HTMLElement
    expect(within(systemRow).queryByRole("button", { name: "삭제" })).toBeNull()
    let row = screen.getByText(customLibrary.name).closest('[role="button"]') as HTMLElement
    await userEvent.click(within(row).getByRole("button", { name: "이름 변경" }))
    const input = screen.getByRole("textbox")
    await userEvent.clear(input)
    await userEvent.type(input, "변경 이름{Enter}")
    expect(props.onRenameLibrary).toHaveBeenCalledExactlyOnceWith(customLibrary.id, "변경 이름")
    row = screen.getByText(customLibrary.name).closest('[role="button"]') as HTMLElement
    await userEvent.click(row)
    expect(props.onSelectLibrary).toHaveBeenCalledExactlyOnceWith(customLibrary.id)
  })
})
