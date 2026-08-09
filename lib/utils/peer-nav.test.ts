import { describe, expect, it } from "vitest"
import { getPeerId } from "@/lib/utils/peer-nav"

const IDS = ["a", "b", "c"]

describe("getPeerId", () => {
  describe("이동 가능한 경우", () => {
    it("중간 항목에서 prev 는 직전 id 를 준다", () => {
      expect(getPeerId(IDS, "b", "prev")).toBe("a")
    })

    it("중간 항목에서 next 는 직후 id 를 준다", () => {
      expect(getPeerId(IDS, "b", "next")).toBe("c")
    })

    it("첫 항목에서 next 는 두 번째 id 를 준다", () => {
      expect(getPeerId(IDS, "a", "next")).toBe("b")
    })

    it("마지막 항목에서 prev 는 직전 id 를 준다", () => {
      expect(getPeerId(IDS, "c", "prev")).toBe("b")
    })
  })

  describe("경계에서 멈춘다", () => {
    it("첫 항목에서 prev 는 null (순환하지 않는다)", () => {
      expect(getPeerId(IDS, "a", "prev")).toBeNull()
    })

    it("마지막 항목에서 next 는 null (순환하지 않는다)", () => {
      expect(getPeerId(IDS, "c", "next")).toBeNull()
    })

    it("항목이 하나뿐이면 양방향 모두 null", () => {
      expect(getPeerId(["only"], "only", "prev")).toBeNull()
      expect(getPeerId(["only"], "only", "next")).toBeNull()
    })
  })

  describe("기준점이 없으면 이동하지 않는다", () => {
    it("빈 목록이면 null", () => {
      expect(getPeerId([], "a", "prev")).toBeNull()
      expect(getPeerId([], "a", "next")).toBeNull()
    })

    it("선택된 id 가 없으면(null) null", () => {
      expect(getPeerId(IDS, null, "prev")).toBeNull()
      expect(getPeerId(IDS, null, "next")).toBeNull()
    })

    // 미리보기를 연 뒤 검색·필터를 바꾸면 선택 항목이 목록에서 이탈할 수 있다
    // (selectedExperience 는 필터 이전의 experiences 전체에서 찾으므로 패널은 열린 채 남는다).
    // 이때 "다음"의 기준점이 없으므로 조용히 첫 항목으로 점프시키지 않고 멈춘다 —
    // 사용자가 의도하지 않은 다른 기록이 열리는 것을 막는다.
    it("선택된 id 가 목록에 없으면 양방향 모두 null", () => {
      expect(getPeerId(IDS, "사라진-id", "prev")).toBeNull()
      expect(getPeerId(IDS, "사라진-id", "next")).toBeNull()
    })
  })
})
