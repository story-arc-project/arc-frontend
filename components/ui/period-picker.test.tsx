import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
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
