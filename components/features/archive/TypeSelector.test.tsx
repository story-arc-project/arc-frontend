import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import TypeSelector from "./TypeSelector"

afterEach(cleanup)

/**
 * FRT-300 경험 유형 선택지를 확정본 14종으로 정리.
 *
 * 확정본에서 내려간 3종(운동·기록·목표)은 **새로 고를 수 없어야** 하지만, 그 유형으로 이미 저장해
 * 둔 기록은 그대로 열리고 편집돼야 한다. 그래서 "목록에서 빠졌는가"와 "이미 선택된 것은 남는가"를
 * 따로 단언한다 — 하나의 목록으로 두 질문에 답하면 한쪽이 조용히 깨진다.
 */
const RETIRED_LABELS = ["운동 및 신체 역량", "기록 (일지/회고)", "목표/계획"]

describe("확정본에서 내려간 유형은 선택지에 없다", () => {
  it("아무것도 고르지 않은 상태에서 은퇴 3종 칩이 없다", () => {
    render(<TypeSelector selectedId={null} onSelect={() => {}} />)

    for (const label of RETIRED_LABELS) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument()
    }
  })

  it("확정본 유형은 그대로 고를 수 있다", () => {
    render(<TypeSelector selectedId={null} onSelect={() => {}} />)

    expect(screen.getByRole("button", { name: "독서" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "봉사활동" })).toBeInTheDocument()
  })

  it("검색으로도 은퇴 유형을 꺼낼 수 없다 — 검색 경로가 다른 목록을 보지 않는다", async () => {
    const user = userEvent.setup()
    render(<TypeSelector selectedId={null} onSelect={() => {}} />)

    await user.type(screen.getByPlaceholderText("유형 검색..."), "운동")

    expect(screen.queryByRole("button", { name: "운동 및 신체 역량" })).not.toBeInTheDocument()
    expect(screen.getByText("검색 결과가 없습니다")).toBeInTheDocument()
  })
})

describe("은퇴 유형으로 저장해 둔 기록은 그대로 편집된다", () => {
  it("접힌 상태에서 은퇴 유형 라벨이 그대로 보인다", () => {
    render(<TypeSelector selectedId="sports" onSelect={() => {}} />)

    expect(screen.getByRole("button", { name: "운동 및 신체 역량" })).toBeInTheDocument()
  })

  it("'변경'을 눌러 펼쳐도 현재 유형은 목록에 남는다 — 변경을 물릴 수 있어야 한다", async () => {
    const user = userEvent.setup()
    render(<TypeSelector selectedId="sports" onSelect={() => {}} />)

    await user.click(screen.getByRole("button", { name: "유형 변경" }))

    const current = screen.getByRole("button", { name: "운동 및 신체 역량" })
    expect(current).toBeInTheDocument()
    expect(current).toHaveAttribute("aria-pressed", "true")
    // 남는 것은 '현재 선택된' 하나뿐이다 — 나머지 은퇴 유형까지 되살아나면 안 된다.
    expect(screen.queryByRole("button", { name: "기록 (일지/회고)" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "목표/계획" })).not.toBeInTheDocument()
  })

  it("확정본 유형을 편집할 때는 은퇴 유형이 하나도 되살아나지 않는다", async () => {
    const user = userEvent.setup()
    render(<TypeSelector selectedId="reading" onSelect={() => {}} />)

    await user.click(screen.getByRole("button", { name: "유형 변경" }))

    for (const label of RETIRED_LABELS) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument()
    }
  })
})
