import type { Block, BlockColumnDef, CellValue, SectionCategory } from "@/types/archive"
import { SECTION_CATEGORIES } from "@/types/archive"
import { cellFilled, cellText, isBlockEmpty, isRequiredBlock, rowHasContent } from "@/lib/utils/block-utils"
import { isRealMonth, parsePeriodString, truncateToMonth } from "@/lib/utils/period-format"

// 같은 그룹의 라벨은 같은 질문으로 간주 — core/type/extended 간 중복 필드를 숨긴다.
const SEMANTIC_GROUPS: Record<string, string[]> = {
  // 구 라벨("읽은 기간/완독일")은 확정본 개편 후에도 남긴다 — 구 레코드의 값은 orphan 블록으로
  // 보존되고 build-portfolio 가 아직 그 라벨로 동의어 폴백 조회를 한다(FRT-236).
  period: ["기간", "재직기간", "근무 기간", "활동 기간", "읽은 기간/완독일", "독서 기간", "제작 기간", "작업 기간", "준비 기간", "학습 기간"],
  // 확정본으로 코어를 뺀 유형(CORE_EXCLUDE)은 그 자리를 이어받은 새 라벨을 **반드시 여기 등록**한다.
  // 코어를 빼는 것과 새 라벨을 동의어로 넣는 것은 한 쌍이다 — 앞만 하면 폴백이던 코어까지 함께
  // 사라져 발행 경로(build-portfolio)가 값을 못 찾고 포트폴리오가 조용히 빈다(FRT-269 리뷰).
  role: ["내 역할/기여도", "내 역할/기여", "내 역할", "내가 맡은 파트", "직책/역할", "역할/직책", "역할 / 직책", "역할", "직무 / 포지션", "참여 역할 / 포지션", "역할 / 기여도"],
  achievement: ["핵심 성과", "핵심 성과 기록", "결과/성과", "성과", "성과/산출물", "반응/성과", "반응 / 피드백", "변화/성과", "임팩트/변화", "단체 활동 / 성과", "개인 활동 / 성과", "나의 담당 업무 / 주요 성과", "주요 성과", "주요 발견 / 결과"],
  team: ["협업/팀", "팀/조직", "팀 구성", "협업 방식", "협업/커뮤니케이션 방식", "협업 / 팀원"],
  motivation: ["지원 동기", "참여 동기", "수강 동기", "읽은 이유", "독서 이유", "목표/만들고 싶었던 이유"],
  // 구 라벨("봉사 확인서")은 확정본 개편 후에도 남긴다 — 구 레코드의 값이 orphan 블록으로
  // 보존되므로 동의어 관계가 끊기면 안 된다(FRT-247, 독서의 '읽은 기간/완독일'과 같은 이유).
  evidence: ["증빙 자료", "증빙", "활동 인증서", "활동 인증서/수료 증빙", "수상 증빙", "자격증 증빙", "봉사 확인서", "봉사 확인서 첨부", "꾸준함 증거"],
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
/**
 * 진행도 판정용 셀 "채워짐" — `cellFilled` 과 달리 열 유형까지 본다.
 *
 * 기간 셀은 종료를 먼저 고르면 시작이 빈 채로(`" ~ 2024.01"`) 저장된다. 사용자가 방금 고른
 * 값을 잃지 않으려는 의도된 직렬화지만, 그 부분 입력이 필수 컬럼을 충족한 것으로 잡히면
 * 진행도가 완료라고 거짓말한다 — 기간은 시작이 있어야 한 기간이다.
 *
 * 텍스트 열을 기간으로 바꾼 셀에는 달력에 없는 옛 값(`"자유 형식 메모"`·`"2023.13"`)이 남는데,
 * 셀은 그걸 못 그려 **빈 칸 + 안내**를 띄운다. 여기서 "있으면 채워짐"으로 세면 화면은 비었는데
 * 진행도만 완료가 된다 — 셀 렌더러와 같은 기준(`isRealMonth`)을 쓴다.
 */
function cellFilledForColumn(column: BlockColumnDef, cell: CellValue | undefined): boolean {
  if (!cellFilled(cell)) return false
  if (column.blockType === "period") {
    return isRealMonth(truncateToMonth(parsePeriodString(cellText(cell)).start))
  }
  return true
}

function isBlockFilledForProgress(block: Block): boolean {
  const v = block.value
  if (v.type === "repeatable-cell") {
    if (v.rows.length === 0) return false
    const requiredCols = v.columns.filter(c => c.required)
    return v.rows.some(row =>
      requiredCols.length > 0
        ? // 필수 컬럼이 있으면 그 컬럼으로만 판정한다 — 사용자가 추가한 항목(FRT-145)이
          // 필수를 대신 충족하면 진행도가 완료로 오판된다.
          requiredCols.every(c => cellFilledForColumn(c, row.cells[c.key]))
        : rowHasContent(row),
    )
  }
  // 블록 층위 기간도 셀과 같은 부분 입력을 만든다 — `PeriodBlock` 이 `formatPeriodString` 을
  // 거치므로 종료를 먼저 고르면 start 가 빈 채로 저장되는데, `isBlockEmpty` 는 start·end 중
  // 하나만 있어도 '안 비었다'라서 그대로 완료가 된다. 여기서도 시작을 요구한다.
  if (v.type === "period") return v.start.trim() !== ""
  return !isBlockEmpty(block)
}

/**
 * 카드(섹션) 하나가 "채워졌는지" 판정한다 — 진행도 바 카운트 기준.
 * 필수 항목이 있으면 그 필수를 모두 채워야 완료, 필수가 없는 섹션(예: 경험 상세·증빙)은
 * 하나라도 채우면 완료로 본다. (선택 입력이 많아 "모든 항목"을 기준으로 하면 바가 거의 안 오름.)
 *
 * `hiddenKeys` 를 주면 사용자가 "해당 없음"으로 치운 항목(FRT-190)을 빼고 센다. 안 빼면 필수
 * 없는 카드에서 **치울수록 완료가 멀어지는** 모순이 난다 — `some(채워짐)` 기준이라 빈 선택 항목을
 * 전부 숨긴 카드는 채울 것이 하나도 안 남는데 영원히 미완료로 남는다.
 * (필수 항목은 애초에 숨길 수 없으므로 필수 기준 카드는 이 인자에 영향받지 않는다.)
 */
export function isCardComplete(card: FormCardModel, hiddenKeys: string[] = []): boolean {
  const hidden = new Set(hiddenKeys)
  const blocks = hidden.size === 0 ? card.blocks : card.blocks.filter(b => !b.key || !hidden.has(b.key))
  const required = blocks.filter(isRequiredBlock)
  if (required.length > 0) return required.every(isBlockFilledForProgress)
  // 치울 것을 다 치워 남은 칸이 없으면 이 카드에서 할 일은 끝났다.
  if (blocks.length === 0) return true
  return blocks.some(isBlockFilledForProgress)
}

/** 표시된 고정 카드들의 진행도(완료 카드 수 / 전체 카드 수). 사용자 추가 섹션은 제외. */
export function computeFormProgress(
  cards: FormCardModel[],
  hiddenKeys: string[] = []
): { done: number; total: number } {
  return { total: cards.length, done: cards.filter(c => isCardComplete(c, hiddenKeys)).length }
}
