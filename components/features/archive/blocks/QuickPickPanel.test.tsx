import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

import QuickPickPanel from "./QuickPickPanel"
import type { QuickPickPreset } from "@/lib/constants/quick-pick-presets"

afterEach(cleanup)

const MULTI: QuickPickPreset = {
  mode: "multi",
  title: "산업 빠른 선택",
  groups: [
    { label: "회사 형태", items: ["스타트업", "대기업"] },
    { label: "기술 · IT", items: ["IT/소프트웨어"] },
  ],
}

const SINGLE: QuickPickPreset = {
  mode: "single",
  title: "직무 빠른 선택",
  groups: [{ label: "기획/전략", items: ["서비스 기획", "PM/PO"] }],
}

function renderPanel(preset: QuickPickPreset, selected: string[] = []) {
  const onPick = vi.fn()
  render(<QuickPickPanel preset={preset} selected={selected} onPick={onPick} />)
  return { onPick, toggle: screen.getByRole("button", { name: /빠른 선택/ }) }
}

describe("QuickPickPanel (FRT-130)", () => {
  describe("평상시엔 버튼 하나만 보인다", () => {
    it("닫힌 상태에서는 항목도 그룹 헤더도 렌더되지 않는다", () => {
      // 확정본이 "태그를 일렬로 늘어놓지 않는다"고 못박은 지점이다.
      renderPanel(MULTI)
      expect(screen.queryByText("스타트업")).toBeNull()
      expect(screen.queryByText("회사 형태")).toBeNull()
    })

    it("토글 버튼이 접힘 상태를 보조기술에 알린다", () => {
      const { toggle } = renderPanel(MULTI)
      expect(toggle).toHaveAttribute("aria-expanded", "false")
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute("aria-expanded", "true")
    })

    it("열면 카테고리별 그룹이 모두 펼쳐진다", () => {
      const { toggle } = renderPanel(MULTI)
      fireEvent.click(toggle)
      expect(screen.getByText("회사 형태")).toBeTruthy()
      expect(screen.getByText("기술 · IT")).toBeTruthy()
      expect(screen.getByRole("button", { name: "스타트업" })).toBeTruthy()
      expect(screen.getByRole("button", { name: "IT/소프트웨어" })).toBeTruthy()
    })

    it("다시 누르면 접힌다", () => {
      const { toggle } = renderPanel(MULTI)
      fireEvent.click(toggle)
      fireEvent.click(toggle)
      expect(screen.queryByText("스타트업")).toBeNull()
    })
  })

  describe("선택 상태 표시", () => {
    it("이미 고른 항목은 눌린 상태로 보인다", () => {
      const { toggle } = renderPanel(MULTI, ["대기업"])
      fireEvent.click(toggle)
      expect(screen.getByRole("button", { name: "대기업" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("button", { name: "스타트업" })).toHaveAttribute("aria-pressed", "false")
    })

    it("목록에 없는 값이 선택돼 있어도 죽지 않고 아무것도 눌리지 않는다", () => {
      // 사용자가 직접 친 값이나 예전 목록의 값이 여기로 들어온다.
      const { toggle } = renderPanel(MULTI, ["직접 친 산업"])
      fireEvent.click(toggle)
      expect(screen.getByRole("button", { name: "스타트업" })).toHaveAttribute("aria-pressed", "false")
    })
  })

  describe("고르면 부모에게 그대로 넘긴다", () => {
    it("다중 선택은 고른 뒤에도 패널이 열려 있다 — 연달아 고르는 게 정상이다", () => {
      const { onPick, toggle } = renderPanel(MULTI)
      fireEvent.click(toggle)
      fireEvent.click(screen.getByRole("button", { name: "스타트업" }))
      expect(onPick).toHaveBeenCalledWith("스타트업")
      expect(screen.getByRole("button", { name: "대기업" })).toBeTruthy()
    })

    it("단일 선택은 고르는 순간 닫힌다 — 방금 고른 값을 패널이 가리지 않게", () => {
      const { onPick, toggle } = renderPanel(SINGLE)
      fireEvent.click(toggle)
      fireEvent.click(screen.getByRole("button", { name: "PM/PO" }))
      expect(onPick).toHaveBeenCalledWith("PM/PO")
      expect(screen.queryByRole("button", { name: "서비스 기획" })).toBeNull()
    })

    it("이미 고른 항목을 다시 눌러도 그대로 넘긴다 — 해제 여부는 부모가 정한다", () => {
      const { onPick, toggle } = renderPanel(MULTI, ["대기업"])
      fireEvent.click(toggle)
      fireEvent.click(screen.getByRole("button", { name: "대기업" }))
      expect(onPick).toHaveBeenCalledWith("대기업")
    })
  })

  it("disabled 면 패널을 열 수 없다", () => {
    const onPick = vi.fn()
    render(<QuickPickPanel preset={MULTI} selected={[]} onPick={onPick} disabled />)
    const toggle = screen.getByRole("button", { name: /빠른 선택/ })
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    expect(screen.queryByText("스타트업")).toBeNull()
  })

  describe("접힌 토글도 어느 픽커인지 구분된다", () => {
    // 접힌 상태에서 보이는 글자는 두 픽커 모두 '빠른 선택' 하나뿐이라, 이름을 프리셋에서
    // 끌어오지 않으면 스크린리더 버튼 탐색에서 산업 토글과 직무 토글이 같은 이름으로 겹친다.
    it("토글의 접근 이름이 프리셋 제목이다", () => {
      renderPanel(MULTI)
      expect(screen.getByRole("button", { name: MULTI.title })).toBeTruthy()
    })

    it("두 픽커를 한 화면에 놓아도 토글 이름이 서로 다르다", () => {
      render(
        <>
          <QuickPickPanel preset={MULTI} selected={[]} onPick={vi.fn()} />
          <QuickPickPanel preset={SINGLE} selected={[]} onPick={vi.fn()} />
        </>
      )
      const names = screen
        .getAllByRole("button")
        .map(b => b.getAttribute("aria-label") ?? b.textContent?.trim() ?? "")
      expect(new Set(names).size).toBe(names.length)
      expect(names).toEqual([MULTI.title, SINGLE.title])
    })
  })
})
