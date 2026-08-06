import type { Block } from "@/types/archive"
import { isBlockEmpty } from "@/lib/utils/block-utils"

/**
 * 조건부 필드 노출 (FRT-211) — 확정본 §7 "'개인/팀' 값이 '팀 수상'으로 시작하면 하위 역할 필드 표시".
 *
 * `hidden-fields.ts`(FRT-190)와 짝이지만 **기준이 다르다**:
 * - 저기: "사용자가 이 칸을 치웠는가" — 영속 상태(`content.hidden` 에 안정키로 저장)
 * - 여기: "지금 트리거 값 기준으로 이 칸이 보여야 하는가" — 어디에도 저장되지 않는 파생 상태
 *
 * 절대 한 목록으로 합치지 않는다. 합치면 조건으로 숨은 필드가 '숨긴 항목 N개' 되살리기 목록에
 * 섞여 나오는데, 사용자는 치운 적이 없으니 되살릴 것도 없다 — 자기가 하지 않은 일을 되돌리라는
 * 버튼이 생긴다.
 *
 * ⚠️ **숨김은 빈 필드에만 적용한다.** `hidden-fields.ts:11-14` 가 FRT-190 에서 이미 내린 결론을
 * 그대로 따른다 — 값이 있는 필드를 숨기면 화면엔 없는데 저장 payload·AI 분석·레쥬메엔 값이 남고
 * (무음 잔존), 숨기며 값을 지우면 실수 한 번에 데이터가 사라진다. 빈 필드로 한정하면 둘 다
 * 발생하지 않고, 상세뷰·진행도 판정도 빈 블록을 이미 세지 않으므로 **소비처를 하나도 건드리지
 * 않는다**. 대가는 "역할을 적어놓고 개인 수상이라고 고른" 모순 상태에서 칸이 값과 함께 남는 것뿐인데,
 * 그 상태에서는 보이는 편이 옳다(설명 없이 값이 사라지는 것보다 낫다).
 */

/**
 * 트리거로 읽을 값 — 드롭다운은 `selected`, 한 줄/여러 줄 텍스트는 `text`.
 *
 * 그 외 타입(날짜·기간·파일·표 등)은 조건 트리거로 쓰지 않는다. 문자열 비교로 환원하면 표기
 * 형식(`2024-05-01` vs `2024.05`)에 조건이 묶여 조용히 깨진다. 빈 문자열을 돌려 **미충족**으로
 * 떨어뜨린다 — 판정할 수 없는 조건을 통과시키면 숨어야 할 필드가 노출된다.
 */
function triggerText(block: Block | undefined): string {
  if (!block) return ""
  const v = block.value
  if (v.type === "single-select") return v.selected
  if (v.type === "text" || v.type === "textarea") return v.text
  return ""
}

/**
 * 이 블록의 노출 조건이 충족됐는지. `visibleWhen` 이 없으면 조건이 없는 것이므로 항상 true.
 *
 * `allBlocks` 는 트리거를 찾을 범위다 — 판정 대상과 분리해서 받는 이유는 `computeFormCards` 가
 * 템플릿 섹션을 4카드로 재구성하기 때문이다. 카드 안 블록만 뒤지면 다른 카드로 간 트리거를
 * 놓쳐 조건이 영원히 미충족이 된다.
 */
export function isConditionMet(block: Block, allBlocks: Block[]): boolean {
  const condition = block.visibleWhen
  if (!condition) return true

  const value = triggerText(allBlocks.find(b => b.key === condition.key))
  if (!value) return false

  if (condition.equals) return condition.equals.includes(value)
  if (condition.startsWith) return condition.startsWith.some(prefix => value.startsWith(prefix))
  // 조건이 키만 지정했으면 "트리거에 값이 있으면 노출".
  return true
}

/**
 * 블록을 노출/조건숨김으로 가른다(원래 순서 보존).
 * 숨기는 것은 **조건 미충족이면서 값이 빈** 블록뿐이다(위 ⚠️ 참고).
 */
export function partitionByCondition(
  blocks: Block[],
  allBlocks: Block[],
): { visible: Block[]; hidden: Block[] } {
  const visible: Block[] = []
  const hidden: Block[] = []
  for (const b of blocks) {
    if (!isConditionMet(b, allBlocks) && isBlockEmpty(b)) hidden.push(b)
    else visible.push(b)
  }
  return { visible, hidden }
}

/**
 * 조건으로 숨은 블록의 안정키 목록 — 진행도 계산에서 빼기 위한 것이다.
 * 안 빼면 필수 없는 카드에서 `some(채워짐)` 기준이라 **보이지도 않는 칸 때문에 영원히 미완료**가 된다.
 */
export function conditionHiddenKeys(allBlocks: Block[]): string[] {
  return partitionByCondition(allBlocks, allBlocks)
    .hidden.filter(b => b.key)
    .map(b => b.key as string)
}
