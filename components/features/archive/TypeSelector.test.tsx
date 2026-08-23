import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EXPERIENCE_TYPES } from "@/lib/constants/templates-v2"
import TypeSelector from "./TypeSelector"

afterEach(cleanup)

/**
 * FRT-300 경험 유형 선택지를 확정본 14종으로 정리 (+ FRT-320 '나는 누구인가?'로 15종).
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
    // FRT-320 — 새 유형은 배열 추가만으로 칩에 파생된다.
    expect(screen.getByRole("button", { name: "나는 누구인가?" })).toBeInTheDocument()
  })

  /**
   * FRT-302 로 유형 검색바가 사라지기 전에는, 이 자리에 "검색으로도 은퇴 유형을 꺼낼 수 없다"가 있었다.
   * 검색은 카테고리 그룹과 **다른 목록을 볼 수 있는 두 번째 렌더 경로**였고, 그 테스트는 두 경로가
   * 같은 목록을 본다는 것을 지켰다. 경로가 하나로 줄어든 지금은 알맹이를 아래 전칭 단언이 이어받는다 —
   * "그려진 칩 = 고를 수 있는 유형", 경로를 세지 않고 결과 집합으로 못박는다.
   */
  it("그려진 칩은 고를 수 있는 유형과 정확히 일치한다", () => {
    render(<TypeSelector selectedId={null} onSelect={() => {}} />)

    const rendered = screen.getAllByRole("button").map(b => b.textContent?.trim())

    // 라벨을 적어 두지 않고 상수에서 파생한다 — 유형이 늘거나 줄어도 이 그물은 따라간다.
    expect([...rendered].sort()).toEqual(EXPERIENCE_TYPES.map(t => t.label).sort())
  })
})

describe("유형 검색바는 없다 (FRT-302)", () => {
  it("검색 입력창이 그려지지 않는다", () => {
    render(<TypeSelector selectedId={null} onSelect={() => {}} />)

    expect(screen.queryByPlaceholderText("유형 검색...")).not.toBeInTheDocument()
  })

  it("검색 결과 빈 상태 문구도 남아 있지 않다", () => {
    render(<TypeSelector selectedId={null} onSelect={() => {}} />)

    expect(screen.queryByText("검색 결과가 없습니다")).not.toBeInTheDocument()
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

/**
 * 흡수된 유형(FRT-291 `team-project`)은 폐기형과 정반대로 다뤄야 한다. 현행 '프로젝트'가 이미 같은
 * 라벨로 목록에 있으므로 **되살리면 안 되고**(같은 이름 칩 두 장), 대신 선택 표시가 현행 유형으로
 * 접혀서 가야 한다. 두 은퇴를 한 규칙으로 처리하면 반드시 한쪽이 깨지는 자리다.
 */
describe("흡수된 유형으로 저장해 둔 기록은 현행 유형으로 접혀 보인다", () => {
  it("접힌 상태에서 '프로젝트' 라벨이 보인다", () => {
    render(<TypeSelector selectedId="team-project" onSelect={() => {}} />)

    expect(screen.getByRole("button", { name: "프로젝트" })).toBeInTheDocument()
  })

  it("'변경'을 눌러 펼치면 '프로젝트' 칩이 한 장뿐이고, 그 칩이 선택돼 있다", async () => {
    const user = userEvent.setup()
    render(<TypeSelector selectedId="team-project" onSelect={() => {}} />)

    await user.click(screen.getByRole("button", { name: "유형 변경" }))

    const chips = screen.getAllByRole("button", { name: "프로젝트" })
    expect(chips).toHaveLength(1)
    expect(chips[0]).toHaveAttribute("aria-pressed", "true")
  })
})
