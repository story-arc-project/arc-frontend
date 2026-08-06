import { describe, it, expect } from "vitest"
import type { Block } from "@/types/archive"
import { createTextField, createSelectField, createDateField } from "@/lib/utils/block-utils"
import { isConditionMet, partitionByCondition } from "@/lib/utils/conditional-fields"

/** 안정키를 붙인 블록 — 템플릿의 withSectionKeys 결과를 흉내낸다. */
function keyed(block: Block, key: string): Block {
  return { ...block, key }
}

function selectBlock(key: string, selected: string, options = ["개인 수상", "팀 수상 (2~5명)", "팀 수상 (6명 이상)"]): Block {
  const b = keyed(createSelectField("개인 / 팀", options), key)
  return { ...b, value: { type: "single-select", options, selected } }
}

function textBlock(label: string, text: string, visibleWhen?: Block["visibleWhen"]): Block {
  const b = createTextField(label)
  return { ...b, visibleWhen, value: { type: "text", text } }
}

const TRIGGER_KEY = "award-info.개인 / 팀"

describe("isConditionMet", () => {
  it("visibleWhen 이 없는 블록은 항상 보인다", () => {
    const target = textBlock("상금 / 부상", "")
    expect(isConditionMet(target, [target])).toBe(true)
  })

  it("트리거 값이 비어 있으면(아직 선택 안 함) 미충족이다", () => {
    const trigger = selectBlock(TRIGGER_KEY, "")
    const target = textBlock("팀에서 내가 맡은 역할", "", { key: TRIGGER_KEY, startsWith: ["팀 수상"] })
    expect(isConditionMet(target, [trigger, target])).toBe(false)
  })

  it("트리거 블록을 찾지 못하면 미충족이다", () => {
    const target = textBlock("팀에서 내가 맡은 역할", "", { key: "없는.키", startsWith: ["팀 수상"] })
    expect(isConditionMet(target, [target])).toBe(false)
  })

  // 확정본 §7 — "값이 '팀 수상'으로 시작하면 하위 역할 필드 표시".
  // 선택지가 '팀 수상 (2~5명)'·'팀 수상 (6명 이상)' 둘로 갈리므로 접두어 판정이어야 한다.
  it.each(["팀 수상 (2~5명)", "팀 수상 (6명 이상)"])(
    "startsWith 는 '%s' 을 충족으로 본다",
    selected => {
      const trigger = selectBlock(TRIGGER_KEY, selected)
      const target = textBlock("팀에서 내가 맡은 역할", "", { key: TRIGGER_KEY, startsWith: ["팀 수상"] })
      expect(isConditionMet(target, [trigger, target])).toBe(true)
    },
  )

  it("startsWith 는 접두어가 다른 값을 미충족으로 본다", () => {
    const trigger = selectBlock(TRIGGER_KEY, "개인 수상")
    const target = textBlock("팀에서 내가 맡은 역할", "", { key: TRIGGER_KEY, startsWith: ["팀 수상"] })
    expect(isConditionMet(target, [trigger, target])).toBe(false)
  })

  it("equals 는 정확히 일치하는 값만 충족으로 본다", () => {
    const target = textBlock("자유 입력", "", { key: TRIGGER_KEY, equals: ["기타"] })
    expect(isConditionMet(target, [selectBlock(TRIGGER_KEY, "기타"), target])).toBe(true)
    expect(isConditionMet(target, [selectBlock(TRIGGER_KEY, "기타 항목"), target])).toBe(false)
  })

  it("텍스트 블록도 트리거가 될 수 있다", () => {
    const trigger = keyed(textBlock("수상 훈격", "대상"), "award-info.수상 훈격")
    const target = textBlock("부상 상세", "", { key: "award-info.수상 훈격", equals: ["대상"] })
    expect(isConditionMet(target, [trigger, target])).toBe(true)
  })

  // 트리거로 쓸 수 없는 타입은 "값 없음"으로 떨어뜨린다 — 조건을 조용히 통과시키면
  // 미충족이어야 할 필드가 노출되어 확정본과 어긋난다.
  it("select·text 가 아닌 타입이 트리거로 지정되면 미충족이다", () => {
    const trigger = keyed(createDateField("수상일"), "award-info.수상일")
    const filled: Block = { ...trigger, value: { type: "date", date: "2024-05-01" } }
    const target = textBlock("파생 필드", "", { key: "award-info.수상일", equals: ["2024-05-01"] })
    expect(isConditionMet(target, [filled, target])).toBe(false)
  })
})

describe("partitionByCondition", () => {
  it("조건 미충족이고 값이 빈 블록만 숨긴다", () => {
    const trigger = selectBlock(TRIGGER_KEY, "개인 수상")
    const role = textBlock("팀에서 내가 맡은 역할", "", { key: TRIGGER_KEY, startsWith: ["팀 수상"] })
    const { visible, hidden } = partitionByCondition([trigger, role], [trigger, role])
    expect(visible.map(b => b.label)).toEqual(["개인 / 팀"])
    expect(hidden.map(b => b.label)).toEqual(["팀에서 내가 맡은 역할"])
  })

  /**
   * D1 핵심 가드 — 조건이 미충족이어도 **값이 있으면 계속 보인다**.
   * 값이 있는 필드를 숨기면 화면엔 없는데 저장 payload·AI 분석·레쥬메엔 값이 남고(무음 잔존),
   * 숨기며 값을 지우면 실수 한 번에 데이터가 사라진다. FRT-190 이 `canHideBlock` 에서 내린
   * 결론과 같은 규칙이며, 이 규칙 덕분에 소비처를 하나도 건드리지 않는다.
   */
  it("조건이 미충족이어도 값이 있으면 계속 보인다", () => {
    const trigger = selectBlock(TRIGGER_KEY, "개인 수상")
    const role = textBlock("팀에서 내가 맡은 역할", "팀장", { key: TRIGGER_KEY, startsWith: ["팀 수상"] })
    const { visible, hidden } = partitionByCondition([trigger, role], [trigger, role])
    expect(visible.map(b => b.label)).toEqual(["개인 / 팀", "팀에서 내가 맡은 역할"])
    expect(hidden).toEqual([])
  })

  it("조건이 충족되면 값이 비어도 보인다", () => {
    const trigger = selectBlock(TRIGGER_KEY, "팀 수상 (2~5명)")
    const role = textBlock("팀에서 내가 맡은 역할", "", { key: TRIGGER_KEY, startsWith: ["팀 수상"] })
    const { visible, hidden } = partitionByCondition([trigger, role], [trigger, role])
    expect(visible).toHaveLength(2)
    expect(hidden).toEqual([])
  })

  it("원래 순서를 보존한다", () => {
    const trigger = selectBlock(TRIGGER_KEY, "개인 수상")
    const a = textBlock("참가 규모 / 경쟁률", "")
    const role = textBlock("팀에서 내가 맡은 역할", "", { key: TRIGGER_KEY, startsWith: ["팀 수상"] })
    const b = textBlock("상금 / 부상", "")
    const all = [a, trigger, role, b]
    const { visible } = partitionByCondition(all, all)
    expect(visible.map(x => x.label)).toEqual(["참가 규모 / 경쟁률", "개인 / 팀", "상금 / 부상"])
  })

  /**
   * 트리거가 다른 카드로 분배돼도 조건이 깨지지 않아야 한다 — `computeFormCards` 는 템플릿 섹션을
   * basic/detail/repeat/evidence 4카드로 **재구성**하므로, 카드 안 블록만 보면 트리거를 놓친다.
   * 그래서 판정 대상(blocks)과 트리거 탐색 범위(allBlocks)를 분리해서 받는다.
   */
  it("트리거가 판정 대상 밖에 있어도 allBlocks 에서 찾는다", () => {
    const trigger = selectBlock(TRIGGER_KEY, "팀 수상 (6명 이상)")
    const role = textBlock("팀에서 내가 맡은 역할", "", { key: TRIGGER_KEY, startsWith: ["팀 수상"] })
    const { visible, hidden } = partitionByCondition([role], [trigger, role])
    expect(visible).toHaveLength(1)
    expect(hidden).toEqual([])
  })
})
