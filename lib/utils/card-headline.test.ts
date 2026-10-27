import { describe, expect, it } from "vitest"
import type { Block, ExperienceV2, TemplateV2 } from "@/types/archive"
import { SYSTEM_TEMPLATES_V2, getTemplateForType } from "@/lib/constants/templates-v2"
import { buildCardHeadline } from "./card-headline"
import { toExperienceV2, toSavePayload } from "./experience-mapper"

function experience(template: TemplateV2 | null = null, overrides: Partial<ExperienceV2> = {}): ExperienceV2 {
  return { id: "exp", userId: "user", typeId: template?.typeId ?? "career", title: "제목", summary: "", status: "complete", tags: [], coreBlocks: structuredClone(template?.commonCore.blocks ?? []), extensionBlocks: structuredClone(template?.extensions.flatMap(s => s.blocks) ?? []), customBlocks: [], hiddenKeys: [], createdAt: "", updatedAt: "", ...overrides }
}
function fill(exp: ExperienceV2, key: string, text: string) {
  const block = [...exp.coreBlocks, ...exp.extensionBlocks].find(b => b.key === key)!
  expect(block, key).toBeDefined()
  if (block.value.type === "repeatable-cell") block.value.rows = [{ id: "row", cells: { [block.value.columns[0].key]: text } }]
  else if (block.value.type === "single-select") block.value.selected = text
  else if (block.value.type === "text" || block.value.type === "textarea") block.value.text = text
  else throw new Error(`Unsupported fixture ${key}`)
}
function textBlock(text: string, label = "본문", extra: Partial<Block> = {}): Block {
  return { id: label, label, type: "textarea", value: { type: "textarea", text }, ...extra }
}
const representatives: Record<string, [string, string]> = {
  education: ["edu-info.성적", "A+"],
  extracurricular: ["extra-detail.주요 성과", "우수 서포터즈 선정"],
  "academic-society": ["society-detail.개인 활동 / 성과", "학회지 논문 게재"],
  club: ["club-detail.주요 성과", "관객 500명 유치"],
  career: ["career-detail.나의 담당 업무 / 주요 성과", "전환율 20% 개선"],
  award: ["award-info.수상 훈격", "대상"],
  certification: ["cert-info.등급/급수", "1급"],
  language: ["lang-overview.전반적 수준", "비즈니스"],
  research: ["research-content.주요 발견 / 결과", "몰입도 감소 확인"],
  "personal-project": ["project-detail.핵심 성과", "DAU 150명 달성"],
  "team-project": ["project-detail.핵심 성과", "베타 2주 만에 출시"],
  volunteer: ["volunteer-info.총 봉사시간", "120시간"],
  overseas: ["overseas-reflection.주요 활동", "국제 팀 프로젝트 참여"],
  "creative-work": ["creative-detail.반응 / 피드백", "전시 관람객 300명"],
  sports: ["sports-log.변화/성과", "10km 완주"],
  reading: ["book-info.한 줄 감상", "관점을 바꾼 한 권"],
  journal: ["journal-info.잘한 점 1개", "꾸준한 회고 습관"],
  goal: ["goal-info.성공 기준", "매주 논문 한 편 읽기"],
  "self-identity": ["self-intro.성격적 강점", "논리적으로 구조화하는 능력"],
}

describe("buildCardHeadline", () => {
  it.each(SYSTEM_TEMPLATES_V2)("extracts a representative input for $typeId including retired types", template => {
    const exp = experience(template, { summary: "요약보다 대표값 우선" })
    const [key, value] = representatives[template.typeId]
    fill(exp, key, value)
    expect(buildCardHeadline(exp, template)).toBe(value)
  })
  it.each(SYSTEM_TEMPLATES_V2)("does not mistake untouched $typeId configuration for input", template => {
    expect(buildCardHeadline(experience(template), template)).toBe("지표를 추가하면 카드가 더 잘 보여요")
  })
  it("prefers recorded language exam scores over general proficiency", () => {
    const template = getTemplateForType("language")
    const exp = experience(template)
    fill(exp, "lang-overview.전반적 수준", "비즈니스")
    const block = exp.extensionBlocks.find(b => b.key === "lang-certificate.어학 자격증")!
    if (block.value.type === "repeatable-cell") block.value.rows = [{ id: "exam", cells: { name: "TOEIC", score: "900점", file: { type: "file", fileId: "f", fileName: "report.pdf" } } }]
    expect(buildCardHeadline(exp, template)).toBe("900점")
  })
  it.each(["lang-certificate.점수 / 등급", "lang-info.점수/등급"])("reads the preserved v1 orphan score %s before proficiency and summary", key => {
    const template = getTemplateForType("language")
    const score: Block = { id: "legacy-score", key, label: "보존된 구 필드", type: "text", value: { type: "text", text: "970점" } }
    // v1 mapper keeps unmatched fields in customBlocks rather than folding the
    // flat certificate into the schema-v2 table.
    const exp = experience(template, { summary: "어학 경험", customBlocks: [score] })
    fill(exp, "lang-overview.전반적 수준", "비즈니스")
    expect(buildCardHeadline(exp, template)).toBe("970점")
  })
  it.each(["점수 / 등급", "점수/등급"])("reads an unambiguous genuinely keyless legacy %s score", label => {
    const template = getTemplateForType("language")
    const score: Block = { id: "legacy-score", label, type: "text", value: { type: "text", text: "970점" } }
    expect(buildCardHeadline(experience(template, { summary: "요약", customBlocks: [score] }), template)).toBe("970점")
  })
  it("does not treat ambiguous or unrelated keyed score labels as legacy representatives", () => {
    const template = getTemplateForType("language")
    const score: Block = { id: "score", label: "점수 / 등급", type: "text", value: { type: "text", text: "970점" } }
    const exp = experience(template, { summary: "요약", customBlocks: [score, { ...score, id: "other" }] })
    expect(buildCardHeadline(exp, template)).toBe("요약")
    exp.customBlocks = [{ ...score, key: "custom.점수 / 등급" }]
    expect(buildCardHeadline(exp, template)).toBe("요약")
  })
  it("prefers stable representative keys over stale core achievement and renamed labels", () => {
    const template = getTemplateForType("career")
    const exp = experience(template)
    exp.coreBlocks.push(textBlock("옛 성과", "핵심 성과"))
    fill(exp, representatives.career[0], "최신 성과")
    exp.extensionBlocks.find(b => b.key === representatives.career[0])!.label = "개명된 표시"
    expect(buildCardHeadline(exp, template)).toBe("최신 성과")
  })
  it("reads keyless legacy achievement synonyms before summary", () => {
    const exp = experience(getTemplateForType("career"), { summary: "요약", extensionBlocks: [textBlock("응답속도 30% 개선", "결과/성과")] })
    expect(buildCardHeadline(exp, getTemplateForType("career"))).toBe("응답속도 30% 개선")
  })
  it("falls back through role, summary and the first body sentence for unknown templates", () => {
    const exp = experience(null, { summary: "  한 줄\n 요약  ", extensionBlocks: [textBlock("기획 담당", "역할 / 직책")] })
    expect(buildCardHeadline(exp, null)).toBe("기획 담당")
    exp.extensionBlocks = [textBlock("첫 문장입니다. 다음 문장입니다.")]
    expect(buildCardHeadline(exp, null)).toBe("한 줄 요약")
    exp.summary = ""
    expect(buildCardHeadline(exp, null)).toBe("첫 문장입니다.")
  })
  it("excludes hidden fields, template-only formHidden, settings, files and URLs", () => {
    const template = getTemplateForType("career")
    const exp = experience(template)
    fill(exp, representatives.career[0], "숨긴 성과")
    exp.hiddenKeys = [representatives.career[0]]
    const config = exp.extensionBlocks.find(b => b.label === "공개 설정")!
    delete config.formHidden
    config.value = { type: "single-select", options: ["공개"], selected: "공개" }
    exp.customBlocks = [textBlock("https://example.com/private"), { id: "file", label: "파일", type: "file", value: { type: "file", fileName: "성과.pdf", description: "첨부 내용", evidenceType: "성과", url: "https://example.com/file" } }]
    expect(buildCardHeadline(exp, template)).toBe("지표를 추가하면 카드가 더 잘 보여요")
  })
  it("excludes formHidden orphan/custom inputs and settings even without a template", () => {
    const exp = experience(null, { customBlocks: [textBlock("숨김", "핵심 성과", { formHidden: true }), textBlock("공개", "공개 설정")] })
    expect(buildCardHeadline(exp, null)).toBe("지표를 추가하면 카드가 더 잘 보여요")
  })
  it("does not expose children of hidden custom sections or hidden summary", () => {
    const exp = experience(null, { summary: "숨긴 요약", coreBlocks: [textBlock("숨긴 요약", "한 줄 요약", { key: "core.한 줄 요약" })], hiddenKeys: ["core.한 줄 요약", "section"], customBlocks: [{ id: "section", key: "section", type: "group", label: "개인 정보", value: { type: "group" }, children: [textBlock("숨긴 그룹의 성과", "핵심 성과")] }] })
    expect(buildCardHeadline(exp, null)).toBe("지표를 추가하면 카드가 더 잘 보여요")
  })
  it("uses user-authored custom text prose as body while excluding template basic names", () => {
    const template = getTemplateForType("career")
    const exp = experience(template)
    fill(exp, "career-info.회사명", "ARC")
    exp.customBlocks = [{ id: "custom-note", label: "메모", type: "text", value: { type: "text", text: "직접 적은 첫 문장입니다. 다음 문장입니다." } }]
    expect(buildCardHeadline(exp, template)).toBe("직접 적은 첫 문장입니다.")
    exp.customBlocks = []
    expect(buildCardHeadline(exp, template)).toBe("지표를 추가하면 카드가 더 잘 보여요")
  })
  it.each([false, true])("keeps custom text body after a real save/load roundtrip (section: %s)", section => {
    const template = getTemplateForType("career")
    const note: Block = { id: "custom-note", label: "메모", type: "text", value: { type: "text", text: "직접 적은 첫 문장입니다. 다음 문장입니다." } }
    const exp = experience(template, { customBlocks: section
      ? [{ id: "custom-section", type: "group", label: "내 기록", value: { type: "group" }, children: [note] }]
      : [note] })
    fill(exp, "career-info.회사명", "ARC")
    expect(buildCardHeadline(exp, template)).toBe("직접 적은 첫 문장입니다.")
    const loaded = toExperienceV2({ ...toSavePayload(exp), id: exp.id, user_id: exp.userId, importance: null, created_at: "", updated_at: "" })
    const restored = section ? loaded.customBlocks[0].children![0] : loaded.customBlocks[0]
    expect(restored.key).toBe(note.id)
    expect(buildCardHeadline(loaded, template)).toBe("직접 적은 첫 문장입니다.")
    loaded.summary = "요약이 본문보다 먼저"
    expect(buildCardHeadline(loaded, template)).toBe("요약이 본문보다 먼저")
  })
  it("excludes template-owned and legacy basic metadata from custom text body", () => {
    const template = getTemplateForType("career")
    const metadata = (extra: Partial<Block>): Block => ({ id: "metadata", key: "saved-custom", label: "메모", type: "text", value: { type: "text", text: "메타데이터" }, ...extra })
    for (const block of [
      metadata({ key: "career-info.회사명" }),
      metadata({ key: "career-info.이전 회사명" }),
      metadata({ label: "회사명" }),
      metadata({ category: "basic" }),
      metadata({ label: "공개 설정" }),
      metadata({ label: "난이도" }),
      metadata({ formHidden: true }),
    ]) {
      expect(buildCardHeadline(experience(template, { customBlocks: [block] }), template)).toBe("지표를 추가하면 카드가 더 잘 보여요")
    }
  })
  it("uses custom location and owning template rather than key spelling to admit prose", () => {
    const template = getTemplateForType("career")
    const note: Block = { id: "note", key: "user.note.with.dots", label: "메모", type: "text", value: { type: "text", text: "내가 적은 본문입니다." } }
    expect(buildCardHeadline(experience(template, { customBlocks: [note] }), template)).toBe("내가 적은 본문입니다.")
    expect(buildCardHeadline(experience(template, { extensionBlocks: [note] }), template)).toBe("지표를 추가하면 카드가 더 잘 보여요")
    expect(buildCardHeadline(experience(template, { customBlocks: [note], hiddenKeys: [note.key!] }), template)).toBe("지표를 추가하면 카드가 더 잘 보여요")
    const owner = structuredClone(template)
    owner.extensions[0].id = "user"
    expect(buildCardHeadline(experience(owner, { customBlocks: [note] }), owner)).toBe("지표를 추가하면 카드가 더 잘 보여요")
  })
  it("returns one normalized long value without mutation or fabricated metrics", () => {
    const template = getTemplateForType("career")
    const exp = experience(template)
    const value = "매출 증가에 기여 ".repeat(80).trim()
    fill(exp, representatives.career[0], `  \n${value}\t `)
    const before = structuredClone(exp)
    const templateBefore = structuredClone(template)
    expect(buildCardHeadline(exp, template)).toBe(value)
    expect(exp).toEqual(before)
    expect(template).toEqual(templateBefore)
  })
  it("skips attachment columns and blank rows in repeatable input", () => {
    const block: Block = { id: "outcome", label: "핵심 성과", type: "repeatable-cell", value: { type: "repeatable-cell", columns: [{ key: "file", label: "첨부", blockType: "file" }, { key: "url", label: "URL", blockType: "link" }, { key: "result", label: "성과", blockType: "textarea" }], rows: [{ id: "blank", cells: { result: " " } }, { id: "filled", cells: { file: { type: "file", fileId: "f", fileName: "비공개.pdf" }, url: "https://example.com", result: "매출 10% 증가" } }] } }
    expect(buildCardHeadline(experience(null, { extensionBlocks: [block] }), null)).toBe("매출 10% 증가")
  })
})
