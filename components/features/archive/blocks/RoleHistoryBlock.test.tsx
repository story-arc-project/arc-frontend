import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import RoleHistoryBlock, { hasRoleHistoryShape } from "./RoleHistoryBlock"
import BlockRenderer from "./BlockRenderer"
import { createRoleHistory, createRepeatableCell } from "@/lib/utils/block-utils"
import { RoleHistoryProvider, type RoleHistoryContextValue } from "@/contexts/RoleHistoryContext"
import type { Block, RepeatableCellBlockValue } from "@/types/archive"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

function makeBlock(roles: { start?: string; end?: string; role: string }[] = []): Block {
  const block = createRoleHistory("역할 이력", { guide: "시기별로 기록해주세요." })
  const value = block.value as RepeatableCellBlockValue
  return {
    ...block,
    value: {
      ...value,
      rows: roles.map((r, i) => ({
        id: `row-${i}`,
        cells: { start: r.start ?? "", end: r.end ?? "", role: r.role },
      })),
    },
  }
}

function Harness({
  initial = [],
  ctx,
}: {
  initial?: { role: string }[]
  ctx?: Partial<RoleHistoryContextValue>
}) {
  const [block, setBlock] = useState(() => makeBlock(initial))
  const value: RoleHistoryContextValue = {
    roles: [],
    renameRole: vi.fn(),
    removeRole: vi.fn(),
    ...ctx,
  }
  return (
    <RoleHistoryProvider value={value}>
      <RoleHistoryBlock block={block} onChange={v => setBlock(prev => ({ ...prev, value: v }))} />
    </RoleHistoryProvider>
  )
}

describe("RoleHistoryBlock", () => {
  it("기록이 없으면 접혀 있고 버튼으로 펼친다", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.queryByLabelText("역할명")).toBeNull()
    await user.click(screen.getByRole("button", { name: /역할 이력 상세 기록/ }))
    expect(screen.getByText("시기별로 기록해주세요.")).toBeDefined()
    // 펼치자마자 바로 쓸 수 있는 빈 줄이 있어야 한다(FRT-103) — 없으면 '역할 추가' 버튼만
    // 놓인 빈 상자가 되고, 그 버튼은 이미 빈 줄이 있을 때 숨는 쪽이 맞다.
    expect(screen.getByLabelText("역할명")).toBeDefined()
    expect(screen.queryByRole("button", { name: "역할 추가" })).toBeNull()
  })

  it("표시용 빈 줄은 value 에 커밋되지 않는다(유령 섹션 방지)", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <RoleHistoryBlock block={makeBlock()} onChange={onChange} />,
    )
    await user.click(screen.getByRole("button", { name: /역할 이력 상세 기록/ }))
    expect(onChange).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText("역할명"), "회")
    expect(onChange).toHaveBeenCalled()
  })

  it("이미 기록이 있으면 펼친 채로 보여준다", () => {
    // 접어두면 입력한 값이 화면에서 사라져 보인다.
    render(<Harness initial={[{ role: "회장" }]} />)
    expect(screen.getByDisplayValue("회장")).toBeDefined()
  })

  it("역할을 추가하고 삭제할 수 있다", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ role: "회장" }]} />)

    await user.click(screen.getByRole("button", { name: "역할 추가" }))
    expect(screen.getAllByLabelText("역할명")).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: "회장 삭제" }))
    expect(screen.queryByDisplayValue("회장")).toBeNull()
  })

  it("역할명을 고치고 편집을 끝내면 rename 을 전파한다", async () => {
    const user = userEvent.setup()
    const renameRole = vi.fn()
    render(<Harness initial={[{ role: "회장" }]} ctx={{ renameRole }} />)

    await user.type(screen.getByLabelText("역할명"), "단")
    // 타이핑 중에는 아직 전파하지 않는다 — 중간 상태는 사용자의 확정이 아니다.
    expect(renameRole).not.toHaveBeenCalled()

    await user.tab()

    expect(renameRole).toHaveBeenCalledTimes(1)
    expect(renameRole).toHaveBeenCalledWith("회장", "회장단")
  })

  it("역할명을 지우고 새로 쓰는 동안 태그를 잃지 않는다", async () => {
    // 기존 이름을 지우고 새 이름을 치는 건 아주 평범한 편집이다. 키 입력마다 전파하면
    // 텍스트가 빈 순간 renameRole(name, "") 이 나가 태그가 통째로 사라지고,
    // 새 이름을 다 친 뒤엔 이어붙일 옛 이름이 남아 있지 않아 복구할 수 없다.
    const user = userEvent.setup()
    const renameRole = vi.fn()
    const removeRole = vi.fn()
    render(<Harness initial={[{ role: "회장" }]} ctx={{ renameRole, removeRole }} />)

    const input = screen.getByLabelText("역할명")
    await user.clear(input)
    await user.type(input, "부회장")

    expect(removeRole).not.toHaveBeenCalled()
    expect(renameRole).not.toHaveBeenCalled()

    await user.tab()

    expect(removeRole).not.toHaveBeenCalled()
    expect(renameRole).toHaveBeenCalledTimes(1)
    expect(renameRole).toHaveBeenCalledWith("회장", "부회장")
  })

  it("이름을 비운 채 편집을 끝내면 태그를 지우지 않는다 — 고아로 남겨 되살릴 수 있게", async () => {
    // 비우고 나간 건 "그 역할이 사라졌다"는 확정이 아니다. 태그를 지우면 되돌릴 수 없지만
    // 고아로 두면 회색 뱃지로 보이고, 같은 이름을 다시 입력하는 순간 정상 태그로 되살아난다.
    const user = userEvent.setup()
    const renameRole = vi.fn()
    const removeRole = vi.fn()
    render(<Harness initial={[{ role: "회장" }]} ctx={{ renameRole, removeRole }} />)

    await user.clear(screen.getByLabelText("역할명"))
    await user.tab()

    expect(removeRole).not.toHaveBeenCalled()
    expect(renameRole).not.toHaveBeenCalled()
  })

  it("이름을 지운 뒤 그 행을 삭제하면 지우기 전 이름으로 태그를 정리한다", async () => {
    // 비운 채로는 전파하지 않지만, 이어서 행을 지우는 건 명시적 확정이다. 이때 셀은 이미
    // 비어 있어 지울 이름을 셀에서 읽을 수 없다 — 마지막으로 유효했던 이름을 기억해 둬야
    // 태그가 영영 고아로 남지 않는다.
    const user = userEvent.setup()
    const removeRole = vi.fn()
    render(<Harness initial={[{ role: "회장" }]} ctx={{ removeRole }} />)

    await user.clear(screen.getByLabelText("역할명"))
    await user.tab()
    expect(removeRole).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "역할 삭제" }))

    expect(removeRole).toHaveBeenCalledTimes(1)
    expect(removeRole).toHaveBeenCalledWith("회장")
  })

  it("역할 행을 지우면 remove 를 전파한다", async () => {
    const user = userEvent.setup()
    const removeRole = vi.fn()
    render(<Harness initial={[{ role: "공연팀장" }]} ctx={{ removeRole }} />)

    await user.click(screen.getByRole("button", { name: "공연팀장 삭제" }))

    expect(removeRole).toHaveBeenCalledTimes(1)
    expect(removeRole).toHaveBeenCalledWith("공연팀장")
  })

  it("같은 역할명이 두 행에 있으면 한 행을 지워도 remove 를 전파하지 않는다", async () => {
    // 회장 재선출처럼 같은 이름이 서로 다른 시기 두 행에 걸쳐 있을 수 있다. 한 행만 지워도
    // 다른 행이 여전히 그 이름을 갖고 있으면(=역할이 아직 유효하면) 폼 전체 태그를 지우면 안 된다.
    const user = userEvent.setup()
    const removeRole = vi.fn()
    render(
      <Harness initial={[{ role: "회장" }, { role: "회장" }]} ctx={{ removeRole }} />,
    )

    await user.click(screen.getAllByRole("button", { name: "회장 삭제" })[0])

    expect(removeRole).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue("회장")).toBeDefined()
  })

  it("같은 역할명이 두 행에 있으면 한 행의 이름을 바꿔도 rename 을 전파하지 않는다", async () => {
    const user = userEvent.setup()
    const renameRole = vi.fn()
    render(
      <Harness initial={[{ role: "회장" }, { role: "회장" }]} ctx={{ renameRole }} />,
    )

    await user.type(screen.getAllByLabelText("역할명")[0], "단")
    await user.tab()

    expect(renameRole).not.toHaveBeenCalled()
  })

  it("기간만 바꾸면 아무것도 전파하지 않는다", async () => {
    const user = userEvent.setup()
    const renameRole = vi.fn()
    const removeRole = vi.fn()
    render(<Harness initial={[{ role: "회장" }]} ctx={{ renameRole, removeRole }} />)

    await user.type(screen.getByLabelText("역할 시작 시점"), "2024-03")

    expect(renameRole).not.toHaveBeenCalled()
    expect(removeRole).not.toHaveBeenCalled()
  })

  it("readOnly 는 기간·역할명을 목록으로 보여준다", () => {
    render(
      <RoleHistoryBlock
        readOnly
        block={makeBlock([{ start: "2024-03", end: "2024-12", role: "회장" }])}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/2024-03 – 2024-12/)).toBeDefined()
    expect(screen.getByText(/회장/)).toBeDefined()
  })
})

describe("BlockRenderer 폴백", () => {
  it("role 컬럼이 있으면 역할 이력 패널로 그린다", () => {
    render(<BlockRenderer block={makeBlock([{ role: "회장" }])} onChange={() => {}} />)
    expect(screen.getByLabelText("역할명")).toBeDefined()
  })

  it("role 컬럼이 없으면 표형으로 폴백한다 — 이름을 만들어낼 자리가 없으므로", () => {
    const broken: Block = {
      ...createRepeatableCell("역할 이력", [{ key: "note", label: "메모", blockType: "text" }]),
      variant: "role-history",
    }
    expect(hasRoleHistoryShape(broken)).toBe(false)
    render(<BlockRenderer block={broken} onChange={() => {}} />)
    expect(screen.queryByRole("button", { name: /역할 이력 상세 기록/ })).toBeNull()
  })
})
