import type { Block } from "@/types/archive"
import { isBlockEmpty } from "@/lib/utils/block-utils"

/**
 * 선택 필드 숨김 (FRT-190) — 확정본 §7 "'선택' 뱃지가 붙은 필드에 한해 × 버튼으로 숨김".
 *
 * 숨김 상태는 `content.hidden` 에 **안정키 배열**로 영속화한다. 값을 지우는 방식은 쓸 수 없다 —
 * schema v2 로드(`toExperienceV2`)는 저장된 블록 배열이 아니라 템플릿 레지스트리에서 필드를
 * 매번 재구성하고 `fields[key]` 로 값만 주입하므로, 값을 비워도 필드 자체는 다음 진입에 되살아난다.
 *
 * 숨김은 **빈 필드에만** 허용한다. 값이 있는 필드를 숨기면 화면엔 없는데 저장 payload·AI 분석·
 * 레쥬메엔 값이 그대로 남아(무음 잔존) 사용자가 설명할 수 없는 결과가 나오고, 숨길 때 값을 지우면
 * 실수 한 번에 데이터가 사라진다. 빈 필드로 한정하면 둘 다 발생하지 않고, 상세뷰·진행도 판정도
 * 빈 블록을 이미 세지 않으므로 소비처를 하나도 건드리지 않는다.
 */

/** 숨김 대상 판정 — 필수 필드와 안정키 없는 사용자 블록은 제외한다(후자는 이미 삭제 버튼이 있다). */
export function canHideBlock(block: Block): boolean {
  return !block.required && !!block.key && isBlockEmpty(block)
}

/**
 * 저장된 숨김 키로 블록을 visible/hidden 으로 가른다(원래 순서 보존).
 *
 * ⚠️ 숨김 키에 있어도 **값이 생겼거나 필수가 된 블록은 자동으로 되돌려 보여준다**. 다른 기기에서의
 * 편집·레거시 마이그레이션·템플릿 개편으로 숨긴 필드에 값이 주입될 수 있는데, 화면에 없는 값은
 * 사용자 입장에서 손실과 구분되지 않는다. `canHideBlock` 과 같은 기준을 쓰는 것이 핵심이다 —
 * 같은 값을 보는 두 함수가 기준을 달리하면 숨길 수는 없는데 숨겨져 있는 필드가 생긴다.
 */
export function resolveHiddenBlocks(
  blocks: Block[],
  hiddenKeys: string[],
): { visible: Block[]; hidden: Block[] } {
  const keys = new Set(hiddenKeys)
  const visible: Block[] = []
  const hidden: Block[] = []
  for (const b of blocks) {
    if (b.key && keys.has(b.key) && canHideBlock(b)) hidden.push(b)
    else visible.push(b)
  }
  return { visible, hidden }
}

/**
 * 저장 직전 숨김 키 정리 — 자동 복귀(`resolveHiddenBlocks`)를 저장에도 반영한다.
 * 이 정리가 없으면 값이 생겨 다시 보이게 된 필드가 저장에는 숨김으로 남아 다음 로드에서
 * (값이 다시 비워지는 순간) 조용히 사라진다.
 *
 * 아는 블록만 판정한다 — 넘어오지 않은 키는 그대로 둔다. `computeFormCards` 의 dedup 으로
 * 카드에서 빠진 블록이나 다른 유형의 키까지 orphan 으로 보고 지우면, 사용자가 숨긴 적 있는
 * 필드가 되돌아왔을 때 숨김이 풀린다.
 */
export function normalizeHiddenKeys(blocks: Block[], hiddenKeys: string[]): string[] {
  const known = new Map(blocks.filter(b => b.key).map(b => [b.key as string, b]))
  const out: string[] = []
  const seen = new Set<string>()
  for (const key of hiddenKeys) {
    if (seen.has(key)) continue
    const block = known.get(key)
    if (block && !canHideBlock(block)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

/** `content.hidden` 방어 파싱 — 배열이 아니거나 원소가 문자열이 아니면 버린다. */
export function parseHiddenKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((k): k is string => typeof k === "string" && k !== "")
}
