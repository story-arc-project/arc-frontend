import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Block, TableBlockValue } from "@/types/archive"
import TableBlock from "./TableBlock"

afterEach(cleanup)
const initial: Block = {
  id: "table-a", type: "table", label: "성과 지표",
  value: { type: "table", columns: ["지표", "지표"], rows: [["첫 값", "둘째 값"], ["셋째 값", "넷째 값"]] },
}
function Editable({ block = initial }: { block?: Block }) {
  const [value, setValue] = useState(block.value as TableBlockValue)
  return <TableBlock block={{ ...block, value }} onChange={setValue} />
}

describe("FRT-275 table cell names", () => {
  it("includes block, current row, and column position even for repeated column labels", () => {
    render(<Editable />)
    expect(screen.getByRole("textbox", { name: "성과 지표 1행 1열 지표" })).toHaveValue("첫 값")
    expect(screen.getByRole("textbox", { name: "성과 지표 1행 2열 지표" })).toHaveValue("둘째 값")
    expect(screen.getByRole("textbox", { name: "성과 지표 2행 1열 지표" })).toHaveValue("셋째 값")
  })
  it("keeps unique label associations for repeated block labels", () => {
    render(<><Editable /><Editable block={{ ...initial, id: "table-b" }} /></>)
    const groups = screen.getAllByRole("group", { name: "성과 지표" })
    expect(groups).toHaveLength(2)
    const ids = groups.map(group => group.getAttribute("aria-labelledby"))
    expect(new Set(ids).size).toBe(2)
    for (const group of groups) expect(within(group).getByRole("textbox", { name: "성과 지표 1행 1열 지표" })).toHaveValue("첫 값")
  })
  it("renumbers remaining rows after deletion and labels newly added rows", async () => {
    const user = userEvent.setup()
    render(<Editable />)
    await user.click(screen.getAllByRole("button", { name: "행 삭제" })[0])
    expect(screen.getByRole("textbox", { name: "성과 지표 1행 1열 지표" })).toHaveValue("셋째 값")
    expect(screen.queryByRole("textbox", { name: "성과 지표 2행 1열 지표" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "행 추가" }))
    expect(screen.getByRole("textbox", { name: "성과 지표 2행 2열 지표" })).toHaveValue("")
  })
  it("labels a keyboard-added column and preserves existing values", async () => {
    const user = userEvent.setup()
    render(<Editable />)
    await user.type(screen.getByPlaceholderText("열 추가..."), "결과{Enter}")
    expect(screen.getByRole("textbox", { name: "성과 지표 1행 3열 결과" })).toHaveValue("")
    expect(screen.getByRole("textbox", { name: "성과 지표 2행 3열 결과" })).toHaveValue("")
    expect(screen.getByRole("textbox", { name: "성과 지표 1행 1열 지표" })).toHaveValue("첫 값")
  })
  it("supports keyboard navigation and editing with the existing value shape", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TableBlock block={initial} onChange={onChange} />)
    await user.tab()
    expect(screen.getByRole("textbox", { name: "성과 지표 1행 1열 지표" })).toHaveFocus()
    await user.tab()
    const second = screen.getByRole("textbox", { name: "성과 지표 1행 2열 지표" })
    expect(second).toHaveFocus()
    await user.clear(second)
    expect(onChange).toHaveBeenLastCalledWith({ type: "table", columns: ["지표", "지표"], rows: [["첫 값", ""], ["셋째 값", "넷째 값"]] })
  })
  it("preserves read-only content without editable controls", () => {
    const onChange = vi.fn()
    render(<TableBlock block={initial} readOnly onChange={onChange} />)
    expect(screen.queryAllByRole("textbox")).toHaveLength(0)
    expect(screen.getByText("첫 값")).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
