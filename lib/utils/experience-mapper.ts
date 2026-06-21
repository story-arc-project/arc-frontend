import type {
  Experience,
  ExperienceSavePayload,
} from "@/types/experience"
import type {
  ExperienceV2,
  ExperienceContentV2,
  ExperienceTypeId,
  ExperienceStatus,
  Block,
  BlockValue,
  CustomEntry,
} from "@/types/archive"
import { isImportanceLevel, SCHEMA_VERSION_V2 } from "@/types/archive"
import {
  EXPERIENCE_TYPE_MAP,
  getTemplateForType,
  TEMPLATE_VERSION,
} from "@/lib/constants/templates-v2"
import { uid, createGroupBlock, isBlockEmpty } from "@/lib/utils/block-utils"

/**
 * Experience ↔ ExperienceV2 매퍼.
 *
 * 저장 JSONB(content)는 schema v2 로 직렬화한다:
 *   { schema_version, template_version, title, summary, status, tags, fields, custom }
 * - fields: 템플릿 블록의 값만 안정키(`${sectionId}.${label}`)로 보관. 존재·순서·라벨·섹션은
 *   템플릿 레지스트리가 결정하므로 라벨 매칭/재분배 없이 화면순서=저장순서가 보장된다.
 * - custom: 템플릿 밖 사용자 블록(순서 있는 배열).
 * importance 는 content 밖 최상위 컬럼으로 유지(PATCH /importance, FRT-39).
 *
 * 인메모리 ExperienceV2 는 기존 block 배열(coreBlocks/extensionBlocks/customBlocks)을 유지해
 * 폼·상세뷰 등 소비처 변경을 최소화한다. 매퍼가 fields 맵 ↔ block 배열을 양방향 브리지한다.
 */

const TITLE_KEY = "core.경험명"
const SUMMARY_KEY = "core.한 줄 요약"
const TITLE_LABEL = "경험명"
const SUMMARY_LABEL = "한 줄 요약"

function hasTemplate(typeId: string): typeId is ExperienceTypeId {
  return typeId in EXPERIENCE_TYPE_MAP
}

function injectValue(block: Block, value: BlockValue | undefined): Block {
  if (value === undefined) return block
  // 타입 불일치(손상된 레거시 데이터·키 충돌 잔재 등)면 주입을 생략해 위젯 렌더 깨짐을 막는다.
  if (value.type !== block.type) return block
  return { ...block, value }
}

/**
 * label → 안정키 맵 (v1 레거시 폴백용).
 * ⚠️ 레지스트리 내에서 라벨이 **유일한** 경우에만 매핑한다. 같은 라벨이 둘 이상 섹션에
 * 존재하면(예: `extended.결과/성과` textarea vs `extra-detail.결과/성과` repeatable-cell)
 * 어느 키로 보낼지 모호하고 타입이 다르면 값이 깨지므로, unkeyed 로 남겨 custom 으로 보존한다.
 */
function labelKeyMap(blocks: Block[]): Record<string, string> {
  const seen = new Map<string, { key: string; count: number }>()
  for (const b of blocks) {
    if (!b.key) continue
    const e = seen.get(b.label)
    if (e) e.count++
    else seen.set(b.label, { key: b.key, count: 1 })
  }
  const map: Record<string, string> = {}
  for (const [label, { key, count }] of seen) {
    if (count === 1) map[label] = key
  }
  return map
}

/**
 * custom[] → Block[].
 * - field 항목은 직렬 복원
 * - section(FRT-78) / 레거시 group(FRT-72) 항목은 depth===0 일 때만 group Block 으로 구조 보존
 * - depth>0(중첩) 은 평탄화 — 1겹 cap
 */
function customEntriesToBlocks(entries: CustomEntry[], depth = 0): Block[] {
  const out: Block[] = []
  for (const e of entries) {
    if (e.entryType === 'field') {
      out.push({
        id: uid('blk'),
        key: e.key,
        type: e.type,
        label: e.label,
        value: e.value,
        ...(e.required ? { required: true } : {}),
        ...(e.options ? { options: e.options } : {}),
      })
    } else if ((e.entryType === 'section' || e.entryType === 'group') && depth === 0) {
      const g = createGroupBlock(e.label)
      g.key = e.key
      g.children = customEntriesToBlocks(e.children, depth + 1)
      out.push(g)
    } else {
      // 중첩(depth>0) section/group → 평탄화 (1-level cap)
      out.push(...customEntriesToBlocks(e.children, depth))
    }
  }
  return out
}

function blockToCustomEntry(b: Block): CustomEntry {
  if (b.type === 'group') {
    // 최상위 사용자 섹션(FRT-78). collapse 는 ephemeral 이라 직렬화하지 않는다.
    return {
      key: b.key ?? b.id,
      entryType: 'section',
      label: b.label,
      children: (b.children ?? []).map(blockToCustomEntry),
    }
  }
  return {
    key: b.key ?? b.id,
    entryType: 'field',
    type: b.type,
    label: b.label,
    value: b.value,
    ...(b.required ? { required: true } : {}),
    ...(b.options ? { options: b.options } : {}),
  }
}

function isHeaderBlock(b: Block): boolean {
  return (
    b.key === TITLE_KEY ||
    b.key === SUMMARY_KEY ||
    b.label === TITLE_LABEL ||
    b.label === SUMMARY_LABEL
  )
}

/**
 * API Experience → 프론트엔드 ExperienceV2 변환
 */
export function toExperienceV2(exp: Experience): ExperienceV2 {
  const content = (exp.content ?? {}) as Record<string, unknown> & {
    schema_version?: number
    title?: string
    summary?: string
    status?: ExperienceStatus
    tags?: string[]
    fields?: Record<string, BlockValue>
    custom?: CustomEntry[]
    coreBlocks?: Block[]
    extensionBlocks?: Block[]
    customBlocks?: Block[]
  }

  const typeId = exp.type as ExperienceTypeId
  const title = content.title ?? ""
  const summary = content.summary ?? ""

  const base = {
    id: exp.id,
    userId: exp.user_id,
    typeId,
    title,
    summary,
    status: content.status ?? ("draft" as ExperienceStatus),
    tags: content.tags ?? [],
    importance: isImportanceLevel(exp.importance) ? exp.importance : undefined,
    createdAt: exp.created_at,
    updatedAt: exp.updated_at,
  }

  // ── v2: 레지스트리 순서로 블록 재구성 + fields 값 주입 ──
  if (content.schema_version === SCHEMA_VERSION_V2 && hasTemplate(exp.type)) {
    const fields = content.fields ?? {}
    const tmpl = getTemplateForType(typeId)
    const coreBlocks = tmpl.commonCore.blocks.map(b => {
      if (b.key === TITLE_KEY) return { ...b, value: { type: "text", text: title } as BlockValue }
      if (b.key === SUMMARY_KEY) return { ...b, value: { type: "text", text: summary } as BlockValue }
      return injectValue(b, b.key ? fields[b.key] : undefined)
    })
    const extensionBlocks = tmpl.extensions
      .flatMap(s => s.blocks)
      .map(b => injectValue(b, b.key ? fields[b.key] : undefined))
    return {
      ...base,
      coreBlocks,
      extensionBlocks,
      customBlocks: customEntriesToBlocks(content.custom ?? []),
    }
  }

  // ── v1 레거시: 저장된 블록 배열 통과 + 레지스트리 라벨매칭으로 안정키 주입 ──
  const savedCore = content.coreBlocks ?? []
  const savedExt = content.extensionBlocks ?? []
  const savedCustom = content.customBlocks ?? []

  if (!hasTemplate(exp.type)) {
    return { ...base, coreBlocks: savedCore, extensionBlocks: savedExt, customBlocks: savedCustom }
  }

  const tmpl = getTemplateForType(typeId)
  const coreKeyByLabel = labelKeyMap(tmpl.commonCore.blocks)
  const extKeyByLabel = labelKeyMap(tmpl.extensions.flatMap(s => s.blocks))

  return {
    ...base,
    coreBlocks: savedCore.map(b => (b.key ? b : { ...b, key: coreKeyByLabel[b.label] })),
    extensionBlocks: savedExt.map(b => (b.key ? b : { ...b, key: extKeyByLabel[b.label] })),
    customBlocks: savedCustom,
  }
}

/**
 * 프론트엔드 ExperienceV2 → API 저장 payload 변환 (항상 schema v2)
 */
export function toSavePayload(exp: ExperienceV2): ExperienceSavePayload {
  const fields: Record<string, BlockValue> = {}
  const custom: CustomEntry[] = []

  for (const b of [...exp.coreBlocks, ...exp.extensionBlocks]) {
    if (isHeaderBlock(b)) continue // 헤더 소유(title/summary)는 content.title/summary 로 저장
    if (b.key) fields[b.key] = b.value
    else custom.push(blockToCustomEntry(b)) // 키 없는(사용자 추가) 블록은 custom 으로 보존
  }
  // 완료 저장 시 완전히 빈 사용자 섹션(group)은 정리한다. 초안은 보존(돌아와 채울 수 있게).
  const customSource =
    exp.status === "complete"
      ? exp.customBlocks.filter(b => !(b.type === "group" && isBlockEmpty(b)))
      : exp.customBlocks
  for (const b of customSource) {
    custom.push(blockToCustomEntry(b))
  }

  const content: ExperienceContentV2 = {
    schema_version: SCHEMA_VERSION_V2,
    template_version: TEMPLATE_VERSION,
    title: exp.title,
    summary: exp.summary,
    status: exp.status,
    tags: exp.tags,
    fields,
    custom,
  }

  return {
    type: exp.typeId,
    importance: exp.importance ?? null,
    content: content as unknown as Record<string, unknown>,
  }
}
