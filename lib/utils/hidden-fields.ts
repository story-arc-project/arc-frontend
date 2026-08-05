import type { Block } from "@/types/archive"
import { isBlockEmpty, isRequiredBlock } from "@/lib/utils/block-utils"

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

/**
 * `isBlockEmpty` 가 안 세는 부속 값이 남아 있는지.
 *
 * `isBlockEmpty` 는 링크를 `url`, 파일을 업로드 신원으로만 판정한다 — "상세뷰에 그릴 게 있는가"를
 * 묻는 기준이라 그 자체로는 옳다. 그런데 두 블록 모두 **주 값 없이 부속 값을 먼저 칠 수 있어서**
 * (LinkBlock 의 제목·유형·설명, FileBlock 의 설명·증빙 유형), 그 상태로 숨기면 화면엔 없는데
 * 저장 payload 엔 남는다 — 이 기능이 막으려던 무음 잔존 그대로다. 숨김만 더 엄격하게 본다.
 *
 * ⚠️ **저장된 값은 타입이 약속한 모양대로 오지 않는다.** `injectValue`(experience-mapper) 는
 * `content.fields[key]` 를 `{...block, value}` 로 통째로 싣는데 `content` 는 서버 JSONB 라,
 * 부속 필드가 빠진 채 저장된 구 레코드가 그대로 블록 값이 된다. 이 판정은 숨김 버튼을 그리며
 * **모든 블록에 대해** 도므로, 여기서 `undefined.trim()` 이 나면 편집 화면이 통째로 터진다.
 */
function isFilledText(s: unknown): boolean {
  return typeof s === "string" && s.trim() !== ""
}

function hasResidualValue(block: Block): boolean {
  const v = block.value
  if (v.type === "link") return [v.title, v.description, v.linkType].some(isFilledText)
  if (v.type === "file") return [v.description, v.evidenceType].some(isFilledText)
  return false
}

/**
 * 표 안에 첨부 열을 품은 블록인지 — 숨김 대상에서 뺀다.
 *
 * 첨부는 **값이 비어 보이는 순간에도 사용자가 이미 한 일이 있다**. 파일을 고른 뒤 업로드가 끝나기
 * 전까지 블록 값은 그대로 비어 있는데, 이때 숨기면 `FileBlock` 이 언마운트되며 `useFileUpload` 가
 * 요청을 abort 하고 늦게 온 결과도 `mountedRef` 가드에서 버려져 **고른 파일이 조용히 사라진다**.
 *
 * ⚠️ 그래서 처음엔 블록 층위 `file` 까지 통째로 뺐는데, 그건 **증빙 카드를 영영 완료할 수 없게**
 * 만들었다 — 그 카드는 `증빙 자료` 파일 블록 하나뿐이고 필수가 없어 `some(채워짐)` 기준이라,
 * 증빙이 없는 사용자는 치울 수도 채울 수도 없어 진행도가 100% 에 닿지 못한다. "해당 없는 항목을
 * 치운다"는 이 기능의 약속이 정작 가장 자주 해당 없는 칸에서 깨졌다.
 *
 * 유실 위험은 **업로드가 진행 중인 동안에만** 있으므로, 그 순간에만 × 를 감춘다(`BlockList` 가
 * `FileBlock` 의 업로드 상태를 받아 처리). 순수 함수인 여기서는 업로드 상태를 알 수 없어
 * 판정하지 않는다 — 값만 보고 "치울 수 있는 칸인가"에만 답한다.
 *
 * 표 쪽은 열 단위 업로드 상태를 위로 흘릴 배선이 없어 그대로 제외한다. 현재 템플릿에 파일 열이
 * 0개라 비용이 없고, 사용자가 열 유형을 파일로 바꾼 경우(FRT-213)만 방어한다.
 */
function hostsAttachment(block: Block): boolean {
  const v = block.value
  if (v.type === "repeatable-cell") return v.columns.some(c => c.blockType === "file")
  return false
}

/**
 * 숨김 대상 판정 — 필수 필드와 안정키 없는 사용자 블록은 제외한다(후자는 이미 삭제 버튼이 있다).
 *
 * 필수 판정은 `isRequiredBlock` 을 쓴다 — 표의 필수는 `block.required` 가 아니라 **컬럼**에
 * 붙어 있고(18유형 중 13개), 블록 층위만 보면 진행도 바가 필수로 세는 표를 사용자가 치울 수 있다.
 */
export function canHideBlock(block: Block): boolean {
  return (
    !isRequiredBlock(block) &&
    !!block.key &&
    isBlockEmpty(block) &&
    !hasResidualValue(block) &&
    !hostsAttachment(block)
  )
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
