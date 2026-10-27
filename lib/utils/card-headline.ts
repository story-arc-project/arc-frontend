import type { Block, ExperienceV2, TemplateV2 } from "@/types/archive"
import { buildDetailSections } from "@/lib/utils/detail-cards"
import { equivalentLabels } from "@/lib/utils/form-cards"

const EMPTY_HEADLINE = "지표를 추가하면 카드가 더 잘 보여요"

// Persisted template keys, not display labels or array positions. Retired types
// keep their own entries because existing records still use their templates.
const LEGACY_LANGUAGE_SCORE_KEYS = ["lang-certificate.점수 / 등급", "lang-info.점수/등급"]
const LEGACY_LANGUAGE_SCORE_LABELS = ["점수 / 등급", "점수/등급"]

const REPRESENTATIVE_KEYS: Record<ExperienceV2["typeId"], string[]> = {
  education: ["edu-info.성적"],
  extracurricular: ["extra-detail.주요 성과"],
  "academic-society": ["society-detail.개인 활동 / 성과", "society-detail.단체 활동 / 성과"],
  club: ["club-detail.주요 성과"],
  career: ["career-detail.나의 담당 업무 / 주요 성과"],
  award: ["award-info.수상 훈격"],
  certification: ["cert-info.등급/급수"],
  language: ["lang-certificate.어학 자격증", ...LEGACY_LANGUAGE_SCORE_KEYS, "lang-overview.전반적 수준"],
  research: ["research-content.주요 발견 / 결과"],
  "personal-project": ["project-detail.핵심 성과", "project-release.사용자 수 / 반응"],
  "team-project": ["project-detail.핵심 성과", "project-release.사용자 수 / 반응"],
  volunteer: ["volunteer-info.총 봉사시간"],
  overseas: ["overseas-reflection.주요 활동"],
  "creative-work": ["creative-detail.반응 / 피드백"],
  sports: ["sports-log.변화/성과", "sports-info.현재 수준"],
  reading: ["book-info.한 줄 감상"],
  journal: ["journal-info.잘한 점 1개"],
  goal: ["goal-info.성공 기준"],
  "self-identity": ["self-intro.성격적 강점", "self-intro.내가 나라는 사람을 스스로 정의한다면"],
}

function normalize(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim()
}

/** One actual input only: never concatenate labels, count rows or infer metrics. */
function inputText(block: Block, columnKey?: string): string {
  const value = block.value
  switch (value.type) {
    case "text":
    case "textarea":
      return normalize(value.text)
    case "single-select":
      return normalize(value.selected)
    case "tags":
      return value.tags.map(normalize).find(Boolean) ?? ""
    case "checklist":
      return value.checked.map(normalize).find(Boolean) ?? ""
    case "repeatable-cell": {
      const columns = value.columns.filter(c =>
        (!columnKey || c.key === columnKey) && (c.blockType === "text" || c.blockType === "textarea"),
      )
      for (const row of value.rows) {
        for (const column of columns) {
          const cell = row.cells[column.key]
          if (typeof cell === "string") {
            const text = normalize(cell)
            if (text) return text
          }
        }
      }
      return ""
    }
    default:
      // Dates, periods, links, files and table/group configuration aren't prose.
      return ""
  }
}

/** A card headline reads the same visible inputs as detail, without changing them. */
export function buildCardHeadline(experience: ExperienceV2, template: TemplateV2 | null): string {
  const hidden = new Set(experience.hiddenKeys)
  const sections = template ? [template.commonCore, ...template.extensions] : []
  const definitions = sections.flatMap(s => s.blocks)
  const visible = (block: Block): boolean => {
    if (block.formHidden || (block.key && hidden.has(block.key)) || hidden.has(block.id)) return false
    if (block.label === "공개 설정" || block.label === "난이도") return false
    const definition = block.key
      ? definitions.find(b => b.key === block.key)
      : definitions.find(b => b.label === block.label && b.type === block.type)
    return !definition?.formHidden
  }
  // buildDetailSections already delegates template/legacy/dedup handling to
  // computeFormCards; filter again for orphan/custom fields and hiddenKeys.
  const visibleExperience = {
    ...experience,
    customBlocks: experience.customBlocks.filter(visible),
  }
  const blocks = buildDetailSections(visibleExperience, template).flatMap(s => s.blocks).filter(visible)
  for (const key of REPRESENTATIVE_KEYS[experience.typeId] ?? []) {
    const definition = definitions.find(b => b.key === key)
    let candidates = blocks.filter(b => b.key === key || (!b.key && definition?.label === b.label && definition.type === b.type))
    if (LEGACY_LANGUAGE_SCORE_KEYS.includes(key) && candidates.length === 0) {
      // v1 orphans retain their keys; only genuinely keyless, unambiguous
      // historical score labels may substitute. A custom keyed label is not an alias.
      const hasKeyedScore = blocks.some(b => b.key && LEGACY_LANGUAGE_SCORE_KEYS.includes(b.key))
      const keylessScores = blocks.filter(b => !b.key && b.type === "text" && LEGACY_LANGUAGE_SCORE_LABELS.includes(b.label))
      if (!hasKeyedScore && keylessScores.length === 1) candidates = keylessScores
    }
    for (const block of candidates) {
      const text = inputText(block, key === "lang-certificate.어학 자격증" ? "score" : undefined)
      if (text) return text
    }
  }
  for (const label of ["핵심 성과", "내 역할/기여도"]) {
    const labels = equivalentLabels(label)
    for (const block of blocks) {
      if (!labels.includes(block.label)) continue
      const text = inputText(block)
      if (text) return text
    }
  }
  const summaryBlock = experience.coreBlocks.find(b => b.key === "core.한 줄 요약" || b.label === "한 줄 요약")
  if (!summaryBlock || visible(summaryBlock)) {
    const summary = normalize(experience.summary) || (summaryBlock ? inputText(summaryBlock) : "")
    if (summary) return summary
  }
  const customTextIds = new Set(visibleExperience.customBlocks.flatMap(b =>
    b.type === "group" ? b.children ?? [] : [b],
  ).filter(b => {
    if (b.type !== "text" || b.category === "basic" || b.category === "evidence") return false
    // customBlocks also contains preserved template orphans. Use the owning
    // template's section namespace (including removed fields), not key presence
    // or a guessed custom-ID format, to keep those metadata fields out.
    if (b.key && sections.some(s => b.key!.startsWith(`${s.id}.`) || s.blocks.some(d => d.key === b.key))) return false
    return !sections.some(s => s.category === "basic" && s.blocks.some(d => d.label === b.label && d.type === b.type))
  }).map(b => b.id))
  for (const block of blocks) {
    // User custom prose remains eligible when save/load adds a stable key.
    // Template basic names and preserved template metadata stay excluded.
    if (block.value.type !== "textarea" && block.value.type !== "repeatable-cell" && !customTextIds.has(block.id)) continue
    const body = inputText(block)
    if (body) return body.split(/(?<=[.!?。！？])\s+/u)[0]
  }
  return EMPTY_HEADLINE
}
