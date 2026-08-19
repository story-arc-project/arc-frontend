import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ReactNode } from "react"

import RoleChips, { roleChipOptions } from "./RoleChips"
import { RoleHistoryProvider, type RoleHistoryContextValue } from "@/contexts/RoleHistoryContext"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

function withRoles(roles: string[], children: ReactNode) {
  const value: RoleHistoryContextValue = {
    roles,
    renameRole: vi.fn(),
    removeRole: vi.fn(),
  }
  return <RoleHistoryProvider value={value}>{children}</RoleHistoryProvider>
}

/** 부모가 값을 소유하는 controlled 사용을 재현한다(선택이 누적되도록). */
function Harness({ roles, initial = [] }: { roles: string[]; initial?: string[] }) {
  const [value, setValue] = useState<string[]>(initial)
  return withRoles(roles, <RoleChips value={value} onChange={setValue} />)
}

describe("roleChipOptions", () => {
  it("등록된 역할을 앞에, 등록 목록에 없는 선택값을 뒤에 붙인다", () => {
    expect(roleChipOptions(["회장", "총무"], ["총무", "공연팀장"])).toEqual([
      "회장",
      "총무",
      "공연팀장",
    ])
  })

  it("역할 이력이 비어도 이미 선택된 값은 살아남는다", () => {
    // 이게 없으면 선택돼 있는데 화면에 안 보여 해제할 방법이 사라진다(FRT-177 교훈).
    expect(roleChipOptions([], ["공연팀장"])).toEqual(["공연팀장"])
  })
})

describe("RoleChips", () => {
  it("등록된 역할을 드롭다운으로 노출하고 선택하면 뱃지가 된다", async () => {
    const user = userEvent.setup()
    render(<Harness roles={["회장", "공연팀장"]} />)

    await user.click(screen.getByText("🏷️ 역할"))
    await user.click(screen.getByRole("button", { name: "공연팀장" }))

    expect(screen.getByRole("button", { name: "공연팀장 역할 태그 해제" })).toBeDefined()
    // 다중 선택은 그대로 — 고르면 닫히므로(FRT-323) 두 번째는 다시 열어서 붙인다.
    await user.click(screen.getByText("🏷️ 역할"))
    await user.click(screen.getByRole("button", { name: "회장" }))
    expect(screen.getByRole("button", { name: "회장 역할 태그 해제" })).toBeDefined()
  })

  it("역할을 고르면 드롭다운이 바로 닫힌다", async () => {
    // FRT-323: 열린 채 남으면 아래 입력칸을 가리고, 닫으려면 옆으로 밀려난 버튼을 다시 찾아야 한다.
    const user = userEvent.setup()
    render(<Harness roles={["회장", "공연팀장"]} />)

    const details = screen.getByText("🏷️ 역할").closest("details")!
    await user.click(screen.getByText("🏷️ 역할"))
    expect(details.open).toBe(true)

    await user.click(screen.getByRole("button", { name: "공연팀장" }))
    expect(details.open).toBe(false)
  })

  it("드롭다운에서 이미 붙은 역할을 해제해도 닫힌다", async () => {
    const user = userEvent.setup()
    render(<Harness roles={["회장"]} initial={["회장"]} />)

    const details = screen.getByText("🏷️ 역할").closest("details")!
    await user.click(screen.getByText("🏷️ 역할"))
    await user.click(screen.getByRole("button", { name: "회장" }))

    expect(details.open).toBe(false)
    expect(screen.queryByRole("button", { name: "회장 역할 태그 해제" })).toBeNull()
  })

  it("'역할' 버튼 자리는 태그가 붙어도 밀리지 않는다", async () => {
    // FRT-323: 버튼이 칩 뒤에 있으면 고를 때마다 오른쪽으로 밀리고 드롭다운도 같이 튄다.
    const user = userEvent.setup()
    render(<Harness roles={["회장", "공연팀장"]} />)

    const details = screen.getByText("🏷️ 역할").closest("details")!
    const slotOfButton = () => Array.from(details.parentElement!.children).indexOf(details)
    const before = slotOfButton()

    await user.click(screen.getByText("🏷️ 역할"))
    await user.click(screen.getByRole("button", { name: "공연팀장" }))

    expect(screen.getByRole("button", { name: "공연팀장 역할 태그 해제" })).toBeDefined()
    expect(slotOfButton()).toBe(before)
  })

  it("뱃지의 × 로 해제할 수 있다", async () => {
    const user = userEvent.setup()
    render(<Harness roles={["회장"]} initial={["회장"]} />)

    await user.click(screen.getByRole("button", { name: "회장 역할 태그 해제" }))
    expect(screen.queryByRole("button", { name: "회장 역할 태그 해제" })).toBeNull()
  })

  it("등록 목록에서 사라진 값도 숨기지 않고 해제할 수 있게 남긴다", async () => {
    const user = userEvent.setup()
    // 역할 이력에는 '회장'만 있는데 이 행에는 구 데이터 '공연팀장'이 붙어 있다.
    render(<Harness roles={["회장"]} initial={["공연팀장"]} />)

    const orphan = screen.getByRole("button", { name: "공연팀장 역할 태그 해제" })
    expect(orphan).toBeDefined()
    // 드롭다운에는 등록된 역할만 뜬다 — 고아를 새로 고를 수는 없다.
    await user.click(screen.getByText("🏷️ 역할"))
    expect(screen.queryByRole("button", { name: "공연팀장" })).toBeNull()

    await user.click(orphan)
    expect(screen.queryByRole("button", { name: "공연팀장 역할 태그 해제" })).toBeNull()
  })

  it("역할 이력이 비어 있으면 먼저 등록하라고 안내한다", async () => {
    const user = userEvent.setup()
    render(<Harness roles={[]} />)

    await user.click(screen.getByText("🏷️ 역할"))
    expect(screen.getByText('먼저 위 "역할 이력"에 역할을 등록해주세요')).toBeDefined()
  })

  it("provider 밖에서는 읽기 전용 뱃지만 그린다", () => {
    render(<RoleChips value={["회장"]} onChange={() => {}} />)
    expect(screen.getByText("회장")).toBeDefined()
    expect(screen.queryByText("🏷️ 역할")).toBeNull()
    expect(screen.queryByRole("button", { name: "회장 역할 태그 해제" })).toBeNull()
  })

  it("readOnly 이고 붙은 태그가 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<RoleChips readOnly value={[]} onChange={() => {}} />)
    expect(container.textContent).toBe("")
  })
})
