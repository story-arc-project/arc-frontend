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
  TemplateV2,
} from "@/types/archive"
import { isImportanceLevel, SCHEMA_VERSION_V2 } from "@/types/archive"
import {
  EXPERIENCE_TYPE_MAP,
  getTemplateForType,
  TEMPLATE_VERSION,
} from "@/lib/constants/templates-v2"
import { uid, createGroupBlock, isBlockEmpty } from "@/lib/utils/block-utils"
import { normalizeHiddenKeys, parseHiddenKeys } from "@/lib/utils/hidden-fields"

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

/**
 * 저장된 표의 컬럼이 템플릿 정의와 그대로인가. 잠금 이전(FRT-104)에는 사용자가 템플릿 표의 열을
 * 추가·삭제할 수 있었으므로, 그런 레코드까지 잠그면 추가한 열을 지울 수도 지운 열을 되살릴 수도 없다.
 * 키 집합만 본다 — 템플릿이 라벨만 손본 경우는 여전히 '그대로'다.
 */
function columnsMatchTemplate(templateValue: BlockValue, savedValue: BlockValue): boolean {
  if (templateValue.type !== "repeatable-cell" || savedValue.type !== "repeatable-cell") return false
  const a = templateValue.columns.map(c => c.key).sort()
  const b = savedValue.columns.map(c => c.key).sort()
  return a.length === b.length && a.every((key, i) => key === b[i])
}

/**
 * text ↔ textarea 는 값 모양이 `{type, text}` 로 동일해 문자열을 그대로 옮겨 실을 수 있다.
 * 이 변환이 없으면 템플릿이 한 줄 → 여러 줄(또는 반대)로 바뀔 때 타입 불일치로 주입이 생략되는데,
 * 그 키는 이미 consumedKeys 라 orphan 보존도 안 되고 재저장 때 빈 값으로 덮인다(무음 손실).
 * 라벨=안정키를 유지한 채 입력 위젯만 바꾸는 개편의 안전망이다.
 *
 * ⚠️ 완전 무손실은 textarea 로 넓히는 방향뿐이다. 반대로 여러 줄 → 한 줄로 좁히면 값 자체는
 * 살아남지만 `<input>` 이 개행을 표시하지 못해, 사용자가 그 칸을 건드리는 순간 줄바꿈이 사라진 채
 * 재저장된다. 템플릿을 textarea → text 로 되돌릴 일이 생기면 그때는 별도 이관이 필요하다.
 */
function textualCompatValue(block: Block, value: BlockValue): BlockValue | null {
  if (value.type !== "text" && value.type !== "textarea") return null
  if (block.type !== "text" && block.type !== "textarea") return null
  return { type: block.type, text: value.text }
}

function injectValue(block: Block, value: BlockValue | undefined): Block {
  if (value === undefined) return block
  // 타입 불일치(손상된 레거시 데이터·키 충돌 잔재 등)면 주입을 생략해 위젯 렌더 깨짐을 막는다.
  // 단 text↔textarea 는 값 모양이 같아 변환해 싣는다.
  if (value.type !== block.type) {
    const compat = textualCompatValue(block, value)
    return compat ? { ...block, value: compat } : block
  }
  // 컬럼을 손댄 레코드는 잠금을 풀어 열 관리 UI 를 돌려준다(FRT-104).
  if (block.lockColumns && !columnsMatchTemplate(block.value, value)) {
    return { ...block, value, lockColumns: false }
  }
  return { ...block, value }
}

/**
 * 편집 모드 병합용 — **정의는 현재 템플릿, 값만 저장분**에서 싣는다.
 *
 * v1 레거시 블록은 구 템플릿의 메타데이터를 통째로 들고 있어 그대로 쓰면 required·guide·
 * placeholder 가 옛 정의로 되돌아간다. 수상경력의 `수상일`은 구 템플릿에서 optional 이라,
 * 저장 블록을 그대로 쓰면 필수 표시가 사라지고 `isRequiredBlock` 기준 완료 판정이 날짜가
 * 비어도 카드를 완료로 본다(FRT-211, Codex P2).
 *
 * 타입 비호환으로 `injectValue` 가 주입을 생략하면(인자를 그대로 반환) 템플릿 블록엔 값이
 * 없어 화면에서 저장값이 사라지므로, 그때는 저장 블록을 그대로 돌려준다 — 값 보존 우선.
 */
export function mergeSavedIntoTemplate(templateBlock: Block, saved: Block): Block {
  const merged = injectValue(templateBlock, saved.value)
  return merged === templateBlock ? saved : merged
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
 * 순수 개명된 안정키의 별칭 — `구 키 → 새 키`.
 *
 * 안정키는 `${sectionId}.${label}` 파생이라 라벨을 바꾸면 키가 통째로 바뀌고, 저장된 값이 새
 * 필드에 붙지 못한다. `orphanFieldsToBlocks` 안전망 덕에 값이 사라지지는 않지만 '기타' 카드로
 * 밀려나, 사용자는 라벨이 바뀌었다는 이유만으로 **같은 정보를 다시 타이핑**해야 한다(FRT-211).
 *
 * ⚠️ **질문이 같은 개명만 넣는다.** 의미가 바뀐 대체는 넣지 않는다 — 수상경력의 '수상명'(상의
 * 이름)·'수상 구분'(드롭다운)을 '수상 훈격'(상의 등급)으로 옮기면 **옛 답이 새 질문의 답으로
 * 둔갑한다**(대회명이 훈격 칸에 들어간다). 그런 값은 '기타' 로 보존해 사용자가 직접 판단하게 둔다.
 */
const RENAMED_FIELD_KEYS: Record<string, string> = {
  'award-info.대회/프로그램명': 'award-info.대회 / 프로그램명',
  'award-info.주최/기관': 'award-info.주최 기관',
  // 어학 확정본(FRT-210) — 구 `lang-info` 8필드 중 **질문도 타입도 같은 둘만** 옮긴다.
  // 나머지는 옮기지 않고 orphan '기타' 카드에 남겨 사용자가 직접 판단하게 둔다:
  //  · '언어'(text→single-select)·'유효기간'(text→date) 은 타입이 바뀌어 injectValue 가 못 싣는다
  //  · '응시일'→'취득일' 은 **질문이 다르다**(응시한 날 ≠ 성적을 취득한 날)
  //  · '강점 영역'(듣기/읽기/말하기/쓰기 4종)→'가능한 활용 영역'(9종) 도 묻는 것이 다르다
  //  · '학습 기간'·'학습 방식'·'활용 사례' 표는 확정본에 대응 필드가 없다
  'lang-info.시험/인증명': 'lang-certificate.시험 / 자격증명',
  'lang-info.점수/등급': 'lang-certificate.점수 / 등급',
  // 독서 확정본(FRT-236) — 구 `reading-info` 6필드 중 **질문도 타입도 같은 넷만** 옮긴다.
  // 나머지는 옮기지 않고 orphan '기타' 카드에 남겨 사용자가 직접 판단하게 둔다:
  //  · '읽은 기간/완독일'(text→period)·'인상 깊은 문장'(textarea→개조식 리스트) 은 타입이
  //    바뀌어 injectValue 가 못 싣는다
  //  · '적용/실험' 표·'추천 대상'·'관련 자료' 는 확정본이 삭제를 지시한 항목이다
  'reading-info.도서명': 'book-info.도서명',
  'reading-info.저자': 'book-info.저자',
  'reading-info.읽은 이유': 'book-info.독서 이유',
  'reading-info.핵심 요약 (3줄)': 'book-info.요약',
  // 봉사 확정본(FRT-247) — 구 `vol-info` 11필드 중 **질문이 같은 일곱만** 옮긴다.
  // 나머지는 옮기지 않고 orphan '기타' 카드에 남겨 사용자가 직접 판단하게 둔다:
  //  · '대상'(아동/노인/동물/환경/기타 5종)→'봉사 분야'(11종)·'활동 형태'(오프라인/온라인/기획/
  //    현장)→'참여 형태'(정기/단기/캠프/온라인/해외) 는 **선택지 도메인이 통째로 다르다.**
  //    타입은 같아 injectValue 가 값을 실어 버리므로, 옮기면 새 목록에 없는 값이 드롭다운에
  //    박혀 고를 수도 지울 수도 없게 된다 — 타입 호환만으로 이관을 판단하면 안 되는 경우다.
  //  · '임팩트/변화'(수혜자에게 생긴 변화)는 확정본에 대응 필드가 없다. ② '배운 점'은 내가
  //    얻은 것을 묻는 다른 질문이라 여기에 실으면 답이 둔갑한다.
  //  · '내 역할'(**required textarea**, 안내 문구 없음)→'역할'(한 줄 text, "예: 학습 멘토,
  //    팀장, 배식 담당") 은 `isInjectableInto` 가 허용하는 text↔textarea 변환이지만 **묻는
  //    granularity 가 다르다.** 문단으로 적힌 답을 한 줄 칸에 실으면 `<input>` 이 값에서 개행을
  //    지워 여러 줄이 **구분자 없이 붙어** 보이고, 그 상태로 한 번만 편집하면 붙은 값이 저장돼
  //    원문이 영구히 사라진다(Codex P2). 프로덕션 코드가 값을 못 지키면 옮기지 않는 쪽이 답이다.
  'vol-info.봉사활동명': 'volunteer-info.봉사 활동명',
  'vol-info.기관/장소': 'volunteer-info.봉사 기관',
  'vol-info.기간': 'volunteer-info.활동 기간',
  'vol-info.총 시간': 'volunteer-info.총 봉사시간',
  'vol-info.활동 내용': 'volunteer-reflection.봉사 내용',
  // 확정본 '배운 점' 가이드가 "얻은 관점, 태도, 배움"이라 구 '느낀 점/가치관 변화'와 같은 질문이다
  // (form-cards 의 SEMANTIC_GROUPS.lesson 도 이미 둘을 동의어로 묶고 있다).
  'vol-info.느낀 점/가치관 변화': 'volunteer-reflection.배운 점',
  'vol-info.봉사 확인서': 'volunteer-info.봉사 확인서 첨부',
}

/**
 * 숨김 키도 개명을 따라간다. 값만 새 키로 옮기고 숨김 상태를 두고 오면, 사용자가 감춰 둔 칸이
 * 템플릿 개편 후 혼자 다시 나타난다 — 게다가 `normalizeHiddenKeys` 는 모르는 키를 버리지 않아
 * 옛 키가 저장분에 영원히 남는다(FRT-210, Codex P2).
 */
function applyRenamedHiddenKeys(keys: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const key of keys) {
    const mapped = RENAMED_FIELD_KEYS[key] ?? key
    if (seen.has(mapped)) continue
    seen.add(mapped)
    out.push(mapped)
  }
  return out
}

/**
 * 저장 블록의 값을 이 템플릿 블록에 실을 수 있는가. `injectValue` 의 허용 범위와 같은 기준이다
 * (동일 타입 또는 text ↔ textarea).
 *
 * v1 레거시의 라벨 폴백이 이 판정을 거쳐야 한다. 라벨은 그대로인 채 입력 위젯만 바뀐 필드에
 * 새 안정키를 붙이면, injectValue 는 값을 못 싣는데 키는 `consumedKeys` 에 잡혀 orphan 보존까지
 * 막힌다 — 화면엔 저장 블록이 보여 멀쩡해 보이지만 한 번 저장하는 순간 값이 증발한다.
 * 어학 확정본의 '언어'(text→single-select)·'유효기간'(text→date)이 그 경우다(FRT-210, Codex P1).
 * v2 는 섹션 id 를 갈아 키가 달라진 덕에 orphan 으로 흐르지만, v1 은 **라벨로 매칭하므로 섹션 id
 * 교체가 닿지 않는다.** 호환되지 않으면 키를 붙이지 않고 '기타' 로 보내 v2 와 경로를 맞춘다.
 */
function isInjectableInto(templateType: Block["type"], savedType: Block["type"]): boolean {
  if (templateType === savedType) return true
  const isTextual = (t: Block["type"]) => t === "text" || t === "textarea"
  return isTextual(templateType) && isTextual(savedType)
}

/**
 * 구 키의 값을 새 키 자리로 옮긴 fields 사본을 돌려준다(원본 불변).
 * 새 키에 이미 값이 있으면 **그쪽이 이긴다** — 개편 후 사용자가 채운 값을 옛 값이 덮으면 안 된다.
 * 옮긴 구 키는 지워 orphan 안전망이 '기타' 에 중복으로 되살리지 않게 한다.
 */
function applyRenamedKeys(fields: Record<string, BlockValue>): Record<string, BlockValue> {
  let out = fields
  for (const [oldKey, newKey] of Object.entries(RENAMED_FIELD_KEYS)) {
    const legacy = out[oldKey]
    if (!legacy) continue
    if (out === fields) out = { ...fields }
    delete out[oldKey]
    const current = out[newKey]
    const currentFilled =
      current && !isBlockEmpty({ id: '', type: current.type, label: '', value: current })
    if (!currentFilled) out[newKey] = legacy
  }
  return out
}

/**
 * v1 레거시용 — 개명된 구 **라벨** → 새 안정키. v1 레코드는 `fields` 맵이 없고 저장된 블록의
 * 라벨로 매칭하므로 키 별칭(`applyRenamedKeys`)이 닿지 않는다.
 *
 * 현재 유형의 템플릿이 실제로 그 새 키를 가질 때만 별칭을 만든다 — 다른 유형에 우연히 같은
 * 라벨의 블록이 있어도 엉뚱한 키가 붙지 않게 하는 유형 게이트다.
 */
function renamedLabelKeyMap(tmpl: TemplateV2): Record<string, string> {
  const templateKeys = new Set<string>()
  for (const s of tmpl.extensions) for (const b of s.blocks) if (b.key) templateKeys.add(b.key)

  const out: Record<string, string> = {}
  for (const [oldKey, newKey] of Object.entries(RENAMED_FIELD_KEYS)) {
    if (!templateKeys.has(newKey)) continue
    out[oldKey.slice(oldKey.indexOf('.') + 1)] = newKey
  }
  return out
}

/**
 * 현재 템플릿이 소비하지 않는 fields 항목(구 템플릿에서 이동·삭제·개편된 필드의 값)을
 * custom 필드 블록으로 보존한다. 이 안전망이 없으면 orphan 값이 로드 시 안 보이고
 * toSavePayload 재직렬화 때 영구 삭제된다(템플릿 개편 시 무음 데이터 손실 방지).
 * 키는 그대로 보존해 재저장 시 custom[] 에 안정적으로 남는다.
 *
 * ⚠️ 빈 값은 보존하지 않는다. toSavePayload 는 키 있는 템플릿 블록을 값이 비어도 fields 에
 * 직렬화하므로, 구 학회 레코드엔 빈 `extended.*`(·이동된 `society-info.지원 동기`) 항목이
 * 흔하다. 이걸 그대로 custom 으로 승격하면 '기타' 카드에 빈 레거시 필드가 영원히 쌓인다
 * (완료 저장은 빈 group 만 정리, 빈 field custom 은 안 지움). 실제 데이터만 보존한다.
 */
function orphanFieldsToBlocks(
  fields: Record<string, BlockValue>,
  consumedKeys: Set<string>,
): Block[] {
  const out: Block[] = []
  for (const [key, value] of Object.entries(fields)) {
    if (consumedKeys.has(key)) continue
    if (!value || typeof value !== "object" || !("type" in value)) continue
    const label = key.includes(".") ? key.slice(key.indexOf(".") + 1) : key
    const block: Block = { id: uid(), key, type: value.type, label, value }
    if (isBlockEmpty(block)) continue
    out.push(block)
  }
  return out
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
    hidden?: unknown
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
    // 숨김 키는 v2 에서만 쓰지만, v1 레거시도 같은 모양(빈 배열)으로 내려 소비처가 분기하지 않게 한다.
    // 개명된 키는 값과 함께 숨김 상태도 따라가야 한다(applyRenamedHiddenKeys).
    hiddenKeys: applyRenamedHiddenKeys(parseHiddenKeys(content.hidden)),
    importance: isImportanceLevel(exp.importance) ? exp.importance : undefined,
    createdAt: exp.created_at,
    updatedAt: exp.updated_at,
  }

  // ── v2: 레지스트리 순서로 블록 재구성 + fields 값 주입 ──
  if (content.schema_version === SCHEMA_VERSION_V2 && hasTemplate(exp.type)) {
    // 개명된 구 키는 새 키 자리로 옮겨 놓고 시작한다 — 라벨이 바뀌었다는 이유로 사용자가 같은
    // 정보를 다시 타이핑하게 만들지 않는다(RENAMED_FIELD_KEYS).
    const fields = applyRenamedKeys(content.fields ?? {})
    const tmpl = getTemplateForType(typeId)
    const coreBlocks = tmpl.commonCore.blocks.map(b => {
      if (b.key === TITLE_KEY) return { ...b, value: { type: "text", text: title } as BlockValue }
      if (b.key === SUMMARY_KEY) return { ...b, value: { type: "text", text: summary } as BlockValue }
      return injectValue(b, b.key ? fields[b.key] : undefined)
    })
    const extensionBlocks = tmpl.extensions
      .flatMap(s => s.blocks)
      .map(b => injectValue(b, b.key ? fields[b.key] : undefined))
    // 템플릿이 소비한 키 집합. 그 밖의 fields 값은 구 템플릿 잔재이므로 custom 으로 보존한다.
    const consumedKeys = new Set<string>()
    for (const b of tmpl.commonCore.blocks) if (b.key) consumedKeys.add(b.key)
    for (const s of tmpl.extensions) for (const b of s.blocks) if (b.key) consumedKeys.add(b.key)
    return {
      ...base,
      coreBlocks,
      extensionBlocks,
      customBlocks: [
        ...customEntriesToBlocks(content.custom ?? []),
        ...orphanFieldsToBlocks(fields, consumedKeys),
      ],
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

  // 저장 블록에 안정키 주입(라벨 폴백) 후, 현재 템플릿 extension 이 소비하는 key/label 로
  // 매칭 여부를 가른다 — ExperienceFormV2 의 섹션 재분배 필터(b.key ? templateKeys : templateLabels)와
  // 동일 기준이다. 어느 섹션에도 안 걸리는 블록(구 템플릿 라벨: 학회 buildExtendedSection→
  // buildSettingsSection 전환 후의 배경/목표·결과/성과·지원 동기 등)을 extensionBlocks 로 두면
  // 폼 로드 시 그 필터에서 탈락→저장 왕복에 유실되므로 custom 으로 보존한다.
  // v2 orphanFieldsToBlocks 안전망의 v1(schema_version 미기재) 대응.
  // 개명 별칭은 v1 에도 적용한다 — v1 은 fields 맵이 없어 키 별칭(applyRenamedKeys)이 닿지 않는데,
  // 같은 순수 개명인데 v2 만 값이 이어지고 v1 은 '기타' 로 밀려나면 반쪽 수정이다.
  const renamedExtKeys = renamedLabelKeyMap(tmpl)
  // 새 라벨 블록이 이미 있으면 별칭을 붙이지 않는다 — 한 키에 두 블록이 겹치면 어느 쪽 값이
  // 살아남는지 배열 순서에 좌우된다.
  const claimedKeys = new Set(
    savedExt.map(b => b.key ?? extKeyByLabel[b.label]).filter((k): k is string => !!k),
  )
  const extTemplateByKey = new Map<string, Block>()
  const extTemplateKeys = new Set<string>()
  const extTemplateLabels = new Set<string>()
  for (const s of tmpl.extensions) for (const b of s.blocks) {
    if (b.key) {
      extTemplateKeys.add(b.key)
      extTemplateByKey.set(b.key, b)
    }
    extTemplateLabels.add(b.label)
  }
  // 타입이 호환되지 않는 매칭은 키를 붙이지 않고 '기타' 로 보낸다(isInjectableInto).
  const keyedExt = savedExt.map(b => {
    const injectable = (key: string | undefined) => {
      const tb = key ? extTemplateByKey.get(key) : undefined
      return !!tb && isInjectableInto(tb.type, b.type)
    }
    if (b.key) {
      const renamed = RENAMED_FIELD_KEYS[b.key]
      const keyed = renamed && !claimedKeys.has(renamed) ? { ...b, key: renamed } : b
      // 현재 템플릿이 그 키를 갖고 있는데 값을 못 실으면 매칭을 포기한다 — 저장 왕복 때 사라진다.
      const blocked = !!keyed.key && extTemplateKeys.has(keyed.key) && !injectable(keyed.key)
      return { block: blocked ? { ...keyed, key: undefined } : keyed, blocked }
    }
    const current = extKeyByLabel[b.label]
    if (current) {
      return injectable(current)
        ? { block: { ...b, key: current }, blocked: false }
        : { block: { ...b, key: undefined }, blocked: true }
    }
    const alias = renamedExtKeys[b.label]
    const usable = !!alias && !claimedKeys.has(alias) && injectable(alias)
    return { block: { ...b, key: usable ? alias : undefined }, blocked: false }
  })
  const matchedExt: Block[] = []
  const orphanExt: Block[] = []
  for (const { block: b, blocked } of keyedExt) {
    const matched =
      !blocked && (b.key ? extTemplateKeys.has(b.key) : extTemplateLabels.has(b.label))
    // 빈 미매칭 블록은 승격하지 않는다(v2 orphanFieldsToBlocks 와 동일 기준). 구 학회 레코드엔
    // 빈 extended.* 항목이 흔한데, 그대로 custom 으로 올리면 '기타' 카드에 빈 레거시 필드가
    // 쌓이고 완료 저장이 이를 영구화한다(빈 group 만 정리, 빈 field custom 은 안 지움).
    if (matched) matchedExt.push(b)
    else if (!isBlockEmpty(b)) orphanExt.push(b)
  }

  return {
    ...base,
    coreBlocks: savedCore.map(b => (b.key ? b : { ...b, key: coreKeyByLabel[b.label] })),
    extensionBlocks: matchedExt,
    customBlocks: [...savedCustom, ...orphanExt],
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
    // 값이 생겼거나 필수가 된 키는 여기서 떨궈진다 — 폼이 정리를 빠뜨려도 저장은 항상 정합적이다.
    hidden: normalizeHiddenKeys([...exp.coreBlocks, ...exp.extensionBlocks], exp.hiddenKeys),
  }

  return {
    type: exp.typeId,
    importance: exp.importance ?? null,
    content: content as unknown as Record<string, unknown>,
  }
}
