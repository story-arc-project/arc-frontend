import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PeriodPicker } from "./period-picker"

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup)

function inputTypes(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("input")).map((el) => el.type)
}

describe("PeriodPicker granularity 토글", () => {
  it("빈 값이면 month 모드(두 입력 모두 type=month)", () => {
    const { container } = render(<PeriodPicker value="" onChange={() => {}} />)
    const types = inputTypes(container).filter((t) => t !== "checkbox")
    expect(types).toEqual(["month", "month"])
  })

  it("월 단위 값에서 month 모드로 추론", () => {
    const { container } = render(<PeriodPicker value="2023.03 ~ 2024.01" onChange={() => {}} />)
    expect(screen.getByRole("radio", { name: "월 단위" })).toHaveAttribute("aria-checked", "true")
    expect(inputTypes(container).filter((t) => t !== "checkbox")).toEqual(["month", "month"])
  })

  it("일 단위 값에서 day 모드로 추론(두 입력 모두 type=date)", () => {
    const { container } = render(
      <PeriodPicker value="2023.03.15 ~ 2024.01.20" onChange={() => {}} />,
    )
    expect(screen.getByRole("radio", { name: "일 단위" })).toHaveAttribute("aria-checked", "true")
    expect(inputTypes(container).filter((t) => t !== "checkbox")).toEqual(["date", "date"])
  })

  it("'일 단위' 클릭 시 입력이 type=date 로 전환", async () => {
    const user = userEvent.setup()
    const { container } = render(<PeriodPicker value="2023.03 ~ 2024.01" onChange={() => {}} />)
    await user.click(screen.getByRole("radio", { name: "일 단위" }))
    expect(inputTypes(container).filter((t) => t !== "checkbox")).toEqual(["date", "date"])
  })

  it("'월 단위' 클릭 시 일 값을 절삭하고 month 포맷으로 onChange 한다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PeriodPicker value="2023.03.15 ~ 2024.01.20" onChange={onChange} />)
    onChange.mockClear()
    await user.click(screen.getByRole("radio", { name: "월 단위" }))
    expect(onChange).toHaveBeenLastCalledWith("2023.03 ~ 2024.01")
  })

  it("month → day 전환은 월 값을 1일로 보정해 일 포맷으로 직렬화한다(혼합 granularity 방지)", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PeriodPicker value="2023.03 ~ 2024.01" onChange={onChange} />)
    onChange.mockClear()
    await user.click(screen.getByRole("radio", { name: "일 단위" }))
    // 기존 연-월은 보존하되 1일로 채워 type=date 입력이 유효하고 일관된 일 포맷이 된다.
    expect(onChange).toHaveBeenLastCalledWith("2023.03.01 ~ 2024.01.01")
  })
})


describe("PeriodPicker 접근성 이름과 맥락", () => {
  it.each([
    ["2023.03 ~ 2024.01", "month"],
    ["2023.03.15 ~ 2024.01.20", "date"],
  ])("%s에서 기간과 시작/종료 이름을 연결한다", (value, type) => {
    render(<PeriodPicker label="재직 기간" value={value} onChange={() => {}} />)
    const group = screen.getByRole("group", { name: "재직 기간" })
    expect(within(group).getByLabelText("재직 기간 시작일")).toHaveAttribute("type", type)
    expect(within(group).getByLabelText("재직 기간 종료일")).toHaveAttribute("type", type)
  })

  it("라벨이 없어도 두 날짜 입력과 그룹을 구별한다", () => {
    render(<PeriodPicker value="" onChange={() => {}} />)
    expect(screen.getByRole("group", { name: "기간" })).toBeInTheDocument()
    expect(screen.getByLabelText("시작일")).toBeInTheDocument()
    expect(screen.getByLabelText("종료일")).toBeInTheDocument()
  })

  it("현재 선택 시 종료일 이름을 유지하고 비활성화하며 값을 보존한다", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PeriodPicker label="재직 기간" value="2023.03 ~ 2024.01" onChange={onChange} />)
    await user.click(screen.getByRole("checkbox", { name: "현재" }))
    expect(screen.getByLabelText("재직 기간 종료일")).toBeDisabled()
    expect(onChange).toHaveBeenLastCalledWith("2023.03 ~ 현재")
    await user.click(screen.getByRole("checkbox", { name: "현재" }))
    expect(screen.getByLabelText("재직 기간 종료일")).toBeEnabled()
    expect(onChange).toHaveBeenLastCalledWith("2023.03 ~ 2024.01")
  })

  it("힌트를 그룹과 두 입력에 연결하고 required는 표시로만 유지한다", () => {
    render(<PeriodPicker label="재직 기간" hint="입사일부터 퇴사일까지" required value="" onChange={() => {}} />)
    expect(screen.getByRole("group", { name: "재직 기간" })).toHaveAccessibleDescription("입사일부터 퇴사일까지")
    for (const name of ["재직 기간 시작일", "재직 기간 종료일"]) {
      expect(screen.getByLabelText(name)).toHaveAccessibleDescription("입사일부터 퇴사일까지")
      expect(screen.getByLabelText(name)).not.toBeRequired()
    }
  })

  it("같은 라벨의 여러 인스턴스도 ID와 연결 대상을 공유하지 않는다", () => {
    const { container } = render(<>
      <PeriodPicker label="기간" hint="첫 기간 안내" value="" onChange={() => {}} />
      <PeriodPicker label="기간" hint="둘째 기간 안내" value="" onChange={() => {}} />
    </>)
    const groups = screen.getAllByRole("group", { name: "기간" })
    groups.forEach((group, index) => {
      const hint = index === 0 ? "첫 기간 안내" : "둘째 기간 안내"
      expect(within(group).getByLabelText("기간 시작일")).toHaveAccessibleDescription(hint)
      expect(within(group).getByLabelText("기간 종료일")).toHaveAccessibleDescription(hint)
    })
    const ids = Array.from(container.querySelectorAll("[id]")).map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
