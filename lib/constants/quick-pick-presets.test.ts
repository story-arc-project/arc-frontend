import { describe, it, expect } from "vitest"
import {
  QUICK_PICK_PRESETS,
  getQuickPickPreset,
  quickPickItems,
  type QuickPickPresetId,
} from "./quick-pick-presets"

const ALL_IDS = Object.keys(QUICK_PICK_PRESETS) as QuickPickPresetId[]

describe("quick-pick 프리셋 (FRT-130)", () => {
  describe("확정본이 정한 모양", () => {
    it("산업 / 회사 종류는 6 카테고리 다중 선택이다", () => {
      const preset = QUICK_PICK_PRESETS.industry
      expect(preset.mode).toBe("multi")
      expect(preset.groups).toHaveLength(6)
    })

    it("산업 첫 그룹 '회사 형태'는 확정본 원문 6종 그대로다", () => {
      // 문서에 문자로 남은 유일한 세부 목록이라 초안이 아니라 확정값이다.
      expect(QUICK_PICK_PRESETS.industry.groups[0]).toEqual({
        label: "회사 형태",
        items: ["스타트업", "대기업", "중견기업", "외국계", "공공기관", "NGO/비영리"],
      })
    })

    it("직무 / 포지션은 5 카테고리 · 총 15종 · 단일 선택이다", () => {
      const preset = QUICK_PICK_PRESETS["job-function"]
      expect(preset.mode).toBe("single")
      expect(preset.groups).toHaveLength(5)
      expect(quickPickItems(preset)).toHaveLength(15)
    })
  })

  describe("모든 프리셋이 지켜야 하는 것", () => {
    it.each(ALL_IDS)("%s — 그룹·항목이 비어 있지 않고 라벨이 공백이 아니다", id => {
      const preset = QUICK_PICK_PRESETS[id]
      expect(preset.groups.length).toBeGreaterThan(0)
      expect(preset.title.trim()).not.toBe("")
      for (const group of preset.groups) {
        expect(group.label.trim()).not.toBe("")
        expect(group.items.length).toBeGreaterThan(0)
        for (const item of group.items) expect(item.trim()).toBe(item)
        for (const item of group.items) expect(item).not.toBe("")
      }
    })

    it.each(ALL_IDS)("%s — 항목 문자열이 프리셋 전체에서 유일하다", id => {
      // 항목 문자열이 곧 저장값이자 '선택됨' 판정 키다. 중복이 있으면 한 항목을 끄면
      // 다른 그룹의 같은 항목까지 같이 꺼진 것처럼 보인다.
      const items = quickPickItems(QUICK_PICK_PRESETS[id])
      expect(new Set(items).size).toBe(items.length)
    })
  })

  describe("getQuickPickPreset — 모르는 id 는 픽커를 끈다", () => {
    it("등록된 id 는 해당 프리셋을 돌려준다", () => {
      expect(getQuickPickPreset("industry")).toBe(QUICK_PICK_PRESETS.industry)
      expect(getQuickPickPreset("job-function")).toBe(QUICK_PICK_PRESETS["job-function"])
    })

    it("모르는 id·빈 값은 null 이라 블록이 기존 자유 입력으로 폴백한다", () => {
      // 새 프론트가 추가한 프리셋을 구 프론트가 만나도 입력이 막히면 안 된다.
      expect(getQuickPickPreset("나중에-생길-프리셋")).toBeNull()
      expect(getQuickPickPreset(undefined)).toBeNull()
      expect(getQuickPickPreset(null)).toBeNull()
      expect(getQuickPickPreset("")).toBeNull()
    })

    it("Object.prototype 상속 키를 프리셋으로 착각하지 않는다", () => {
      expect(getQuickPickPreset("toString")).toBeNull()
      expect(getQuickPickPreset("constructor")).toBeNull()
    })
  })
})
