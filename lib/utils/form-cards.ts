import type { Block, SectionCategory } from "@/types/archive"
import { SECTION_CATEGORIES } from "@/types/archive"
import { cellFilled, isBlockEmpty } from "@/lib/utils/block-utils"

// 같은 그룹의 라벨은 같은 질문으로 간주 — core/type/extended 간 중복 필드를 숨긴다.
const SEMANTIC_GROUPS: Record<string, string[]> = {
  period: ["기간", "재직기간", "읽은 기간/완독일", "제작 기간", "준비 기간", "학습 기간"],
  role: ["내 역할/기여도", "내 역할/기여", "내 역할", "내가 맡은 파트", "직책/역할", "역할/직책", "역할"],
  achievement: ["핵심 성과", "핵심 성과 기록", "결과/성과", "성과", "성과/산출물", "반응/성과", "변화/성과", "임팩트/변화", "단체 활동 / 성과", "개인 활동 / 성과"],
  team: ["협업/팀", "팀/조직", "팀 구성", "협업 방식", "협업/커뮤니케이션 방식", "협업 / 팀원"],
  motivation: ["지원 동기", "참여 동기", "읽은 이유", "목표/만들고 싶었던 이유"],
  evidence: ["증빙 자료", "증빙", "활동 인증서", "활동 인증서/수료 증빙", "수상 증빙", "자격증 증빙", "봉사 확인서", "꾸준함 증거"],
  lesson: ["배운 점", "느낀 점/가치관 변화", "성장 / 변화"],
}

function getSemanticGroup(label: string): string | null {
  for (const [key, labels] of Object.entries(SEMANTIC_GROUPS)) {
    if (labels.includes(label)) return key
  }
  return null
}

/**
 * 주어진 라벨과 같은 의미 그룹(동의어)에 속하는 라벨 목록을 반환한다.
 * 그룹이 없으면 자기 자신만. 폼 dedup 으로 코어 대신 type-specific extension 에
 * 값이 저장된 경우, 소비처(예: 포트폴리오 매퍼)가 동등 라벨로 폴백 조회할 때 쓴다.
 */
export function equivalentLabels(label: string): string[] {
  const group = getSemanticGroup(label)
  return group ? SEMANTIC_GROUPS[group] : [label]
}

function hasEquivalentIn(label: string, others: Set<string>): boolean {
  if (others.has(label)) return true
  const group = getSemanticGroup(label)
  if (!group) return false
  return SEMANTIC_GROUPS[group].some(eq => others.has(eq))
}

const TITLE_KEY = "core.경험명"
const SUMMARY_KEY = "core.한 줄 요약"
const EVIDENCE_KEY = "core.증빙 자료"

function isTitle(b: Block): boolean { return b.key === TITLE_KEY || b.label === "경험명" }
function isSummary(b: Block): boolean { return b.key === SUMMARY_KEY || b.label === "한 줄 요약" }
/** 코어 증빙 자료 블록은 항상 evidence 카드에 표시 — dedup 대상에서 제외. */
function isEvidenceBlock(b: Block): boolean { return b.key === EVIDENCE_KEY || b.label === "증빙 자료" }

export interface FormCardSection { id: string; category: SectionCategory; blocks: Block[] }
export interface FormCardModel {
  category: SectionCategory
  label: string
  blocks: Block[]
  optional?: boolean
  showOptionalBadge?: boolean
}
export interface FormCardsResult {
  titleBlock?: Block
  summaryBlock?: Block
  cards: FormCardModel[]
  visibleCategories: SectionCategory[]
}

export function computeFormCards(
  coreBlocks: Block[],
  sections: FormCardSection[],
  labelOverrides?: Partial<Record<SectionCategory, string>>,
): FormCardsResult {
  const titleBlock = coreBlocks.find(isTitle)
  const summaryBlock = coreBlocks.find(isSummary)
  // 코어 증빙 자료는 항상 evidence 카드에 넣는다 (원래 formLayout도 별도 추출하여 항상 표시).
  const coreEvidenceBlock = coreBlocks.find(b => !isTitle(b) && !isSummary(b) && isEvidenceBlock(b))

  // type-specific 섹션(basic/repeat, extended 제외) 라벨 = canonical anchor
  const typeSections = sections.filter(s => s.id !== "extended")
  const anchorLabels = new Set<string>()
  for (const s of typeSections) for (const b of s.blocks) anchorLabels.add(b.label)

  // core 블록(헤더·증빙 제외) 분류 + dedup
  const buckets: Record<SectionCategory, Block[]> = { basic: [], detail: [], repeat: [], evidence: [] }

  // 코어 증빙 자료는 항상 evidence 버킷에 직접 추가 (dedup 없음)
  if (coreEvidenceBlock) buckets.evidence.push(coreEvidenceBlock)

  const keepCoreOrExtended = (b: Block, others: Set<string>) =>
    !isBlockEmpty(b) || !hasEquivalentIn(b.label, others)

  // 1) type-specific 섹션 블록 → category 그대로 (anchor 이므로 dedup 대상 아님)
  for (const s of typeSections) {
    for (const b of s.blocks) buckets[b.category ?? s.category].push(b)
  }

  // 2) core 블록(헤더·증빙 제외) → block.category, anchor 와 중복 dedup
  const coreNonHeader = coreBlocks.filter(b => !isTitle(b) && !isSummary(b) && !isEvidenceBlock(b))
  const survivingCore: Block[] = []
  for (const b of coreNonHeader) {
    if (keepCoreOrExtended(b, anchorLabels)) {
      buckets[b.category ?? "detail"].push(b)
      survivingCore.push(b)
    }
  }

  // 3) extended 섹션(detail) → anchor + 살아남은 core 라벨과 중복 dedup
  const usedLabels = new Set<string>(anchorLabels)
  for (const b of survivingCore) usedLabels.add(b.label)
  const extended = sections.find(s => s.id === "extended")
  for (const b of extended?.blocks ?? []) {
    if (keepCoreOrExtended(b, usedLabels)) buckets[b.category ?? "detail"].push(b)
  }

  const cards: FormCardModel[] = []
  for (const { id, label } of SECTION_CATEGORIES) {
    const blocks = buckets[id]
    if (blocks.length === 0) continue
    cards.push({
      category: id,
      label: labelOverrides?.[id] ?? label,
      blocks,
      optional: id === "detail" || undefined,
      showOptionalBadge: id === "detail" || undefined,
    })
  }

  return {
    titleBlock,
    summaryBlock,
    cards,
    visibleCategories: cards.map(c => c.category),
  }
}

/**
 * 진행도 판정용 "채워짐". 대부분은 !isBlockEmpty 와 같지만, repeatable-cell 은
 * 빈 행(방금 추가한 blank row)을 완료로 오판하지 않도록 필수 컬럼(없으면 아무 셀)이
 * 실제로 채워진 행이 하나라도 있는지까지 본다.
 */
function isBlockFilledForProgress(block: Block): boolean {
  const v = block.value
  if (v.type === "repeatable-cell") {
    if (v.rows.length === 0) return false
    const requiredCols = v.columns.filter(c => c.required)
    return v.rows.some(row =>
      requiredCols.length > 0
        ? requiredCols.every(c => cellFilled(row.cells[c.key]))
        : Object.values(row.cells).some(cellFilled),
    )
  }
  return !isBlockEmpty(block)
}

/**
 * 진행도 판정용 "필수 블록". block.required 뿐 아니라, 블록 자체는 optional 이어도
 * 필수 컬럼을 가진 repeatable-cell(예: 학회 프로젝트 기록·수업 기록)도 필수로 본다.
 * 이렇게 하지 않으면 optional 형제 필드만 채워도 카드가 완료로 오판된다.
 */
function isRequiredBlock(block: Block): boolean {
  if (block.required) return true
  if (block.value.type === "repeatable-cell") {
    return block.value.columns.some(c => c.required)
  }
  return false
}

/**
 * 카드(섹션) 하나가 "채워졌는지" 판정한다 — 진행도 바 카운트 기준.
 * 필수 항목이 있으면 그 필수를 모두 채워야 완료, 필수가 없는 섹션(예: 경험 상세·증빙)은
 * 하나라도 채우면 완료로 본다. (선택 입력이 많아 "모든 항목"을 기준으로 하면 바가 거의 안 오름.)
 */
export function isCardComplete(card: FormCardModel): boolean {
  const required = card.blocks.filter(isRequiredBlock)
  return required.length > 0
    ? required.every(isBlockFilledForProgress)
    : card.blocks.some(isBlockFilledForProgress)
}

/** 표시된 고정 카드들의 진행도(완료 카드 수 / 전체 카드 수). 사용자 추가 섹션은 제외. */
export function computeFormProgress(cards: FormCardModel[]): { done: number; total: number } {
  return { total: cards.length, done: cards.filter(isCardComplete).length }
}
