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
import {
  uid,
  cloneBlocks,
  createGroupBlock,
  isBlockDiscardable,
  isBlockEmpty,
  normalizeBlockValue,
  normalizeBlocks,
  type BlockDefs,
} from "@/lib/utils/block-utils"
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
  // 저장 값이 통째로 깨졌으면(null·비객체) 주입을 **생략**한다 (FRT-200) — 되살릴 알맹이가 없다.
  // ⚠️ 여기서 빈 값으로 덮으면 안 된다: 템플릿 블록의 value 는 드롭다운 `options`·표 `columns`
  // 같은 정의를 들고 있어서, 빈 값으로 갈면 선택지·열이 통째로 사라진다.
  if (!value || typeof value !== "object") return block
  // 객체면 `type` 이 깨져 있어도 싣는다 — 블록이 선언한 타입이 복구 근거가 되고, 알맹이를
  // 버리면 열었다 저장하는 것만으로 사용자 입력이 지워진다. 값이 온전하면 같은 참조가 돌아온다.
  const templateColumns =
    block.value?.type === "repeatable-cell" ? block.value.columns : undefined
  const safe = normalizeBlockValue(block.type, value, {
    options: block.options,
    columns: templateColumns,
  })
  // 타입 불일치(손상된 레거시 데이터·키 충돌 잔재 등)면 주입을 생략해 위젯 렌더 깨짐을 막는다.
  // 단 text↔textarea 는 값 모양이 같아 변환해 싣는다.
  if (safe.type !== block.type) {
    const compat = textualCompatValue(block, safe)
    return compat ? { ...block, value: compat } : block
  }
  // 컬럼을 손댄 레코드는 잠금을 풀어 열 관리 UI 를 돌려준다(FRT-104).
  if (block.lockColumns && !columnsMatchTemplate(block.value, safe)) {
    return { ...block, value: safe, lockColumns: false }
  }
  return { ...block, value: safe }
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
 * v1 저장 블록의 정의(선택지·열) 출처 — 현재 템플릿에서 **라벨로** 찾는다.
 *
 * v1 은 안정키가 없어 라벨이 유일한 연결고리다. 라벨이 안 걸리면 `undefined` 를 돌려
 * 블록 자신이 든 정의만 쓰게 한다 — 없는 정의를 지어내지 않는다.
 */
function templateDefsResolver(
  expType: string,
  typeId: ExperienceTypeId,
): ((block: Block) => BlockDefs | undefined) | undefined {
  if (!hasTemplate(expType)) return undefined
  const tmpl = getTemplateForType(typeId)
  const byLabel = new Map<string, Block>()
  for (const b of [...tmpl.commonCore.blocks, ...tmpl.extensions.flatMap(s => s.blocks)]) {
    for (const t of [b, ...(b.children ?? [])]) {
      if (!byLabel.has(t.label)) byLabel.set(t.label, t)
    }
  }
  return block => {
    const match = byLabel.get(block.label)
    if (!match || match.type !== block.type) return undefined
    return {
      options: match.options,
      columns: match.value?.type === "repeatable-cell" ? match.value.columns : undefined,
    }
  }
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
        // ⚠️ 형제 `orphanFieldsToBlocks` 의 가드를 복사하면 안 된다 (FRT-200). 그쪽은 값이
        // 깨졌으면 블록을 통째로 버리는데, 여기서 그러면 **사용자가 직접 만든 칸이 사라진다** —
        // custom 은 값이 아니라 필드의 존재 자체가 정보다. 게다가 여긴 `e.type` 이 값과 별도로
        // 남아 있어 복구할 근거가 있다(orphan 은 `value.type` 이 유일한 타입 신호라 근거가 없다).
        value: normalizeBlockValue(e.type, e.value, { options: e.options }),
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
  // 해외경험 확정본(FRT-249) — 구 `overseas-info`/`overseas-challenges` 9필드 중 **둘만** 옮긴다.
  // 나머지는 옮기지 않고 orphan '기타' 카드에 남겨 사용자가 직접 판단하게 둔다:
  //  · '경험 유형'(교환학생/연수/여행/해외 인턴/기타 5종)→'경험 유형'(9종) 은 **라벨도 타입도
  //    같고 선택지 도메인만 다르다.** 섹션 id 교체가 없었다면 키가 같아 값이 그대로 실렸을 자리다
  //    (봉사 '대상'·'활동 형태'와 같은 함정 — 새 목록에 없는 값이 드롭다운에 박힌다).
  //  · '언어 사용 수준'→'사용 언어' 는 타입이 같지만 **묻는 것이 다르다**(수준 ≠ 언어명).
  //    옮기면 '일상 회화 가능' 이 언어명 칸의 답으로 둔갑한다.
  //  · '목적'·'활동 요약'·'어려웠던 상황' 표·'성과/산출물' 은 확정본이 삭제한 항목이다
  //    (설계 노트: 경험 요약은 '주요 활동'과 서술이 중복되어 삭제).
  //
  // ⚠️ 구 `core.증빙 자료` 는 여기 넣을 수 **없다** — 이 맵은 유형 구분이 없는 전역 맵이라
  //    `core.*` 를 출발점으로 쓰면 그 키를 쓰는 다른 9유형까지 함께 끌려간다. 대신 유형 스코프인
  //    `V2_CORE_SCOPED_MIGRATIONS` 가 맡는다(FRT-249, Codex P2).
  //
  // 구 `overseas-info.기간` 은 옮긴다. 목적지 `overseas-program.기간` 은 이번에 새로 생긴 키라
  // 항상 비어 있어 `applyRenamedKeys` 의 "목적지가 차 있으면 진다" 규칙에 걸리지 않는다.
  'overseas-info.기간': 'overseas-program.기간',
  'overseas-info.국가/도시': 'overseas-program.국가 / 도시',
  // 파일 증빙은 select 와 달리 도메인이 닫혀 있지 않다 — `FileBlock` 이 옛 자유입력 evidenceType
  // 이 새 options 에 없으면 선택지에 덧붙여 살려 두므로(FileBlock.tsx), 옮겨도 값이 박히지 않는다.
  'overseas-challenges.증빙': 'overseas-program.증빙 자료',
  // 창작물 확정본(FRT-267) — 구 `cw-info`/`cw-process` 10필드 중 **질문도 타입도 같은 다섯만** 옮긴다.
  // 나머지는 옮기지 않고 orphan '기타' 카드에 남겨 사용자가 직접 판단하게 둔다:
  //  · '분야'(디자인/글/영상/음악/사진/일러스트/기타 7종)→'유형 / 매체'(13종) 은 **같은 질문인데
  //    선택지가 통째로 다시 짜였다.** 라벨까지 바뀌어 v1 라벨 매칭도 닿지 않는다. 값 조건부로
  //    옮겨야 하므로 `SELECT_DOMAIN_MIGRATIONS` 가 맡는다(여기 넣으면 '디자인' 이 무조건 실린다).
  //  · '제작 과정'(repeatable-cell 4컬럼)→'제작 과정'(textarea)·'공개 링크'(link)→'작품 링크 /
  //    파일'(repeatable-cell) 은 타입이 달라 injectValue 가 못 싣는다. 전자는 **라벨까지 같아**
  //    v1 라벨 매칭이 정면으로 닿는 자리라, `isInjectableInto` 가 유일한 방어선이다(FRT-210 Codex P1).
  //  · '한 줄 소개'·'저작권/사용 범위' 는 확정본에 대응 칸이 없다. 전자를 코어 '한 줄 요약'으로
  //    보내면 헤더 요약이 사용자 모르게 덮일 수 있어 옮기지 않는다.
  //
  // ⚠️ 구 `core.증빙 자료` 는 `V2_CORE_SCOPED_MIGRATIONS` 에도 넣지 않는다 — 확정본 ① 의 목적지가
  //    '작품 링크 / 파일'(repeatable-cell) 뿐이라 `file` 값을 받을 타입 호환 자리가 없다.
  //    옮기면 하류 injectValue 가 주입을 생략해 값이 어디에도 없이 사라진다(FRT-249 ⑩ 의 타입 가드).
  'cw-info.작품/작업물명': 'creative-info.작품명 / 작업물명',
  'cw-info.제작 기간': 'creative-info.작업 기간',
  'cw-info.사용 도구': 'creative-info.사용 툴 / 기술',
  // 확정본 '작업 배경 / 컨셉' 가이드가 "이 작품을 만든 배경, 컨셉, **의도**"라 구 '의도/주제'와
  // 같은 질문이다. 타입도 textarea 로 같다.
  'cw-info.의도/주제': 'creative-detail.작업 배경 / 컨셉',
  // 확정본 '반응 / 피드백' 가이드가 조회수·반응·채택 사례를 묶어 물어 구 '반응/성과'와 같은 질문이다
  // (SEMANTIC_GROUPS.achievement 도 이미 둘을 동의어로 묶고 있다).
  'cw-process.반응/성과': 'creative-detail.반응 / 피드백',
  // 연구논문 확정본(FRT-269) — 구 `research-info` 13필드 중 **질문도 타입도 같은 셋만** 옮긴다.
  // 나머지는 옮기지 않고 orphan '기타' 카드에 남겨 사용자가 직접 판단하게 둔다:
  //  · '역할'(주저자/공저/연구원/RA)→'역할 / 기여도'(5종) 은 **같은 질문인데 선택지가 통째로 다시
  //    짜였다.** 값 조건부로 옮겨야 하므로 `SELECT_DOMAIN_MIGRATIONS` 가 맡는다.
  //  · '연구 질문/가설'→'연구 주제 / 배경' 은 **묻는 것이 다르다**(무엇을 검증하려 했나 ≠ 왜
  //    시작했나). 확정본 가이드가 "어떤 문제 의식에서 시작됐고, 왜 중요한지"라 배경을 묻는다.
  //  · '결과 요약'→'초록 / 핵심 요약' 도 다르다 — 확정본 초록은 목적·방법·결과 **전체**의 요약이라
  //    결과만 적힌 옛 답을 실으면 초록 칸이 채워진 것처럼 보인다(FRT-211 의 '개명 vs 대체').
  //  · '방법/설계'(textarea)→'연구 방법론'(개조식)·'재현/공유 자료'(link)→'논문 파일 /
  //    링크'(repeatable-cell)·'성과'(tags) 는 타입이 달라 injectValue 가 못 싣는다.
  //  · '내가 맡은 파트'(textarea)→'역할 / 기여도'(select) 도 타입이 다르고, 문단으로 적은 답을
  //    드롭다운 한 칸이 대신할 수 없다.
  //  · '데이터/자료 출처'·'참고문헌/관련 읽을거리'·'산출물' 은 확정본에 대응 칸이 없다.
  //
  // ⚠️ 구 `core.증빙 자료` 는 이관 대상이 아니다 — 확정본 ④ 가 곧 그 코어 증빙 카드라
  //    `CORE_EXCLUDE.research` 가 빼지 않는다. 키가 그대로이므로 옮길 것 자체가 없다.
  'research-info.연구 주제/논문 제목': 'research-paper.연구 / 논문 제목',
  'research-info.소속/기관/랩': 'research-paper.소속 기관 / 연구실',
  // 목적지 `research-paper.연구 기간` 은 이번에 새로 생긴 키라 항상 비어 있어
  // `applyRenamedKeys` 의 "목적지가 차 있으면 진다" 규칙에 걸리지 않는다.
  'research-info.기간': 'research-paper.연구 기간',
}

/**
 * **선택지 도메인이 통째로 교체된** single-select 의 구 키 → 새 키(유형 스코프).
 *
 * `RENAMED_FIELD_KEYS` 와 두 가지가 다르다.
 *
 * 1. **값 조건부**다. 저장된 답이 새 선택지 목록에 **그대로 남아 있을 때만** 옮기고, 아니면
 *    구 키를 손대지 않아 orphan '기타' 카드로 흐르게 둔다. 해석이 필요한 답을 시스템이 대신
 *    정하지 않는다는 뜻이다 — 해외경험 '연수'는 새 목록의 '어학연수'로 좁히면 기업 연수를 다녀온
 *    사람의 답이 둔갑하므로(FRT-211 의 '개명 vs 대체'), 사용자가 원본을 보고 직접 고르게 둔다.
 * 2. 옮길 때 **선택지를 템플릿 것으로 정규화**한다. 저장값이 들고 온 옛 목록을 그대로 실으면
 *    `SingleSelectBlock` 이 그쪽을 우선해(`val.options.length > 0 ? val.options : block.options`)
 *    확정본이 새로 준 선택지를 영영 못 받고, 다음 저장에 그 상태가 굳는다.
 *
 * 옮길 수 있는데 안 옮기면 새 필드는 **값 없는 required 칸**이 된다 — 완료 저장된 레코드를 다시
 * 연 사용자가 **바뀐 것도 없는 답을 다시 골라야** 저장이 된다(FRT-249, Codex P1 과 같은 양식의 P2).
 *
 * 이 판정은 **v1·v2 양쪽에** 같게 적용한다. v2 는 섹션 id 가 갈려 키로, v1 은 `fields` 맵이 없어
 * 라벨로 매칭하지만(FRT-210), 사용자에게 스키마 버전이 보이면 안 된다.
 *
 * ⚠️ 라벨이 **바뀐** 대체(봉사 '대상'→'봉사 분야', 어학 '강점 영역'→'가능한 활용 영역')는 여기
 * 넣지 않는다 — 질문 자체가 달라진 것이라 값이 남아 있어도 옮기면 안 된다.
 */
type ScopedMigration = {
  from: string
  to: string
  /** 값을 실을 수 있으면 (필요하면 정규화해서) 돌려주고, 못 실으면 null → 구 키 보존. */
  carry: (templateBlock: Block | undefined, saved: BlockValue) => BlockValue | null
}

const SELECT_DOMAIN_MIGRATIONS: Partial<Record<ExperienceTypeId, ScopedMigration[]>> = {
  // 해외경험 확정본(FRT-249): '경험 유형' 5종(교환학생/연수/여행/해외 인턴/기타) → 9종.
  // 새 목록에 그대로 남은 답은 '교환학생'·'기타' 둘이고, 나머지 셋은 이름이 바뀌었다
  // (연수→어학연수 · 여행→여행/자유 탐방 · 해외 인턴→해외 인턴/취업).
  overseas: [
    {
      from: 'overseas-info.경험 유형',
      to: 'overseas-program.경험 유형',
      carry: carrySelectValue,
    },
  ],
  // 창작물 확정본(FRT-267): '분야' 7종(디자인/글/영상/음악/사진/일러스트/기타) → '유형 / 매체' 13종.
  // 새 목록에 **그대로** 남은 답은 '사진'·'기타' 둘뿐이고, 나머지 다섯은 이름이 바뀌었거나
  // (글→글/문학 · 영상→영상/모션 · 음악→음악/사운드 · 일러스트→일러스트/그림) 여러 갈래로
  // 쪼개졌다(디자인 → 그래픽/디자인 · 브랜딩 · 웹/앱 UI · 제품 · 공간). 어느 쪽이든 좁히면
  // **답이 둔갑**하므로 옮기지 않고 사용자가 원본을 보고 직접 고르게 둔다.
  //
  // ⚠️ 위 라벨-변경 대체 금지 규칙의 예외다. 그 규칙의 근거는 "질문 자체가 달라졌다"인데
  // ('대상'=누구를 도왔나 → '봉사 분야'=어떤 영역인가), 여기서는 라벨만 다듬였을 뿐 묻는 것이
  // 그대로다(이 작업의 매체가 무엇인가). 판정 기준은 라벨이 아니라 **질문**이다(FRT-211).
  'creative-work': [
    {
      from: 'cw-info.분야',
      to: 'creative-info.유형 / 매체',
      carry: carrySelectValue,
    },
  ],
  // 연구논문 확정본(FRT-269): '역할' 5종(주저자/공저/연구원/RA/기타) → '역할 / 기여도' 5종.
  // 새 목록에 **그대로** 남은 답은 '기타' 하나뿐이다 — '주저자'→'제 1저자(주저자)'·'공저'→'공동
  // 저자' 는 이름이 바뀌었고, '연구원'·'RA' 는 확정본이 '연구 참여(데이터 수집·분석)'로 역할의
  // 성격을 묻는 쪽으로 바꿔 신분과 1:1이 아니다. 어느 쪽이든 좁히면 답이 둔갑하므로 옮기지 않고
  // 사용자가 원본을 보고 직접 고르게 둔다.
  //
  // 창작물 '분야'와 같은 예외 적용이다 — 라벨이 '역할'→'역할 / 기여도'로 바뀌었지만 묻는 것은
  // 그대로다(이 연구에서 내가 무엇이었나). 판정 기준은 라벨이 아니라 **질문**이다(FRT-211).
  research: [
    {
      from: 'research-info.역할',
      to: 'research-paper.역할 / 기여도',
      carry: carrySelectValue,
    },
  ],
}

/**
 * 출발 키가 `core.*` 라 **전역 맵에 넣을 수 없는** 이관.
 *
 * `RENAMED_FIELD_KEYS` 에 `core.증빙 자료` 를 출발점으로 넣으면 그 키를 쓰는 다른 9유형까지
 * 함께 끌려간다. 유형 스코프라야 표현되는 이관이다(FRT-249, Codex P2).
 *
 * ⚠️ 이름은 `V2_` 로 남아 있지만 **v1 레코드도 같은 규칙을 탄다**(FRT-267 Codex P2). v1 은
 * `fields` 맵이 없어 `applyScopedMigrations` 가 닿지 않으므로, v1 경로가 저장된 코어 배열을
 * 직접 훑어 같은 이관을 수행한다(`toExperienceV2` 꼬리). 한쪽만 이관하면 같은 유형인데
 * 레코드 세대에 따라 권위 있는 칸의 개수가 갈린다.
 */
const V2_CORE_SCOPED_MIGRATIONS: Partial<Record<ExperienceTypeId, ScopedMigration[]>> = {
  // 개편 전 해외경험 폼은 코어 증빙(`isEvidenceBlock` 이라 dedup 을 안 타 '활동 증빙' 카드로
  // 항상 보였다)과 `overseas-challenges.증빙` 을 동시에 노출했다 — 첨부가 코어 쪽에만 있는
  // 레코드가 실재한다. 확정본은 증빙을 ① 안에 두므로 코어를 뺐고(CORE_EXCLUDE), 옮기지 않으면
  // 그 파일은 '기타' 로 밀리고 ① 증빙 칸은 빈 채로 남는다.
  overseas: [
    { from: 'core.증빙 자료', to: 'overseas-program.증빙 자료', carry: carryCompatibleValue },
  ],
  // 창작물은 구 템플릿에 role 앵커가 없어 코어 '내 역할/기여도'가 실제로 렌더됐다 — 값이 든
  // 레코드가 실재한다. 그 코어를 **남겨 두기만 하면** 확정본 '역할'과 함께 두 칸이 살아나는데,
  // 둘 다 값이 있으면 `pickValue` 가 정확 라벨을 먼저 고르므로(build-portfolio.ts) 사용자가 새
  // '역할'을 고쳐도 포트폴리오는 **옛 코어 값을 계속 발행한다** — 화면과 산출물이 어긋나는
  // 무음 오염이다(FRT-267 Codex P2). 값을 확정본 칸으로 옮겨 권위 있는 칸을 하나로 만든다.
  //
  // 이관 후 코어는 비므로 `keepCoreOrExtended` 가 숨기고, 옮겨진 값은 '개인 작업'을 골라도
  // 화면에 남는다(`partitionByCondition` 은 **빈** 블록만 숨긴다). textarea→text 는
  // `isInjectableInto` 가 허용하고 문자열은 그대로 보존된다 — 위젯만 한 줄로 좁아진다.
  // ⚠️ v1 레코드도 같은 이관을 받는다 — 한때 "v1 은 값 유실이 없으니 두 칸이 남아도 된다"고
  //    미뤘지만, 남는 두 칸이 바로 위에 적은 무음 오염 그 자체였다(FRT-267 Codex P2).
  // ⚠️ 확정본 '역할'은 한 줄 `text` 다 — 여러 줄 값은 `carryIntoSingleLine` 이 걸러 구 코어 칸에
  //    남긴다. 옮기면 `<input>` 이 개행을 지워 문단이 사라진다(그때는 칸이 둘로 남지만, 화면에
  //    둘 다 보이므로 사용자가 판단할 수 있다 — 값이 뭉개지는 쪽이 훨씬 나쁘다).
  'creative-work': [
    { from: 'core.내 역할/기여도', to: 'creative-info.역할', carry: carryIntoSingleLine },
  ],
}

/**
 * 도메인이 교체된 select 의 저장값을 새 템플릿 블록에 실을 수 있으면 **템플릿 선택지로
 * 정규화한** 값을, 아니면 `null`(→ orphan '기타' 보존)을 돌려준다.
 */
function carrySelectValue(
  templateBlock: Block | undefined,
  saved: BlockValue | undefined,
): BlockValue | null {
  if (!templateBlock || templateBlock.type !== 'single-select') return null
  if (saved?.type !== 'single-select') return null
  const options = templateBlock.options ?? []
  if (!saved.selected || !options.includes(saved.selected)) return null
  return { type: 'single-select', options: [...options], selected: saved.selected }
}

/** 타입만 맞으면 그대로 싣는다(text↔textarea 변환은 하류의 `injectValue` 가 맡는다). */
function carryCompatibleValue(
  templateBlock: Block | undefined,
  saved: BlockValue,
): BlockValue | null {
  if (!templateBlock) return null
  return isInjectableInto(templateBlock.type, saved.type) ? saved : null
}

/**
 * `carryCompatibleValue` 에 **"한 줄 칸에 여러 줄을 넣지 않는다"**를 더한다.
 *
 * `isInjectableInto` 는 text↔textarea 를 호환으로 본다 — 저장 형식이 같은 문자열이니 맞는 말이다.
 * 그런데 목적지가 `text` 면 화면에 뜨는 것은 `<input>` 이고, **브라우저가 input value 에서 개행을
 * 지운다.** 문단이 든 구 '내 역할/기여도'를 그대로 옮기면 사용자는 첫 화면부터 한 줄로 뭉개진 값을
 * 보고, 한 글자만 고쳐도 그 뭉개진 값이 저장된다 — 조용한 데이터 손실이다(FRT-267 Codex P2).
 *
 * 여러 줄이면 옮기지 않는다. 값은 구 코어 칸에 그대로 남아 화면에도 보이고 발행에도 쓰인다 —
 * 옮길 수 없는 값을 시스템이 뭉개는 대신 원본을 두고 사용자가 판단하게 한다(`carrySelectValue` 와 같은 철학).
 */
function carryIntoSingleLine(
  templateBlock: Block | undefined,
  saved: BlockValue,
): BlockValue | null {
  const carried = carryCompatibleValue(templateBlock, saved)
  if (!carried || templateBlock?.type !== 'text') return carried
  const raw = carried.type === 'text' || carried.type === 'textarea' ? carried.text : ''
  return /[\r\n]/.test(raw) ? null : carried
}

/**
 * v2 `fields` 에 유형 스코프 이관 규칙을 적용한 사본을 돌려준다(원본 불변).
 *
 * ⚠️ 전역 `applyRenamedKeys` 와 결정적으로 다른 점: **못 옮길 때 구 키를 손대지 않는다.**
 * 전역 쪽은 목적지가 차 있으면 구 키를 보존 없이 delete 해서 값이 조용히 사라지는데
 * (FRT-247 에서 확인), 여기서는 구 키가 남아 orphan '기타' 카드로 흘러 사용자가 볼 수 있다.
 */
function applyScopedMigrations(
  fields: Record<string, BlockValue>,
  rules: ScopedMigration[],
  templateByKey: Map<string, Block>,
): Record<string, BlockValue> {
  let out = fields
  for (const { from, to, carry } of rules) {
    const legacy = out[from]
    if (!legacy) continue
    const carried = carry(templateByKey.get(to), legacy)
    if (!carried) continue
    const current = out[to]
    const currentFilled =
      current && !isBlockEmpty({ id: '', type: current.type, label: '', value: current })
    if (currentFilled) continue
    if (out === fields) out = { ...fields }
    delete out[from]
    out[to] = carried
  }
  return out
}

/**
 * 숨김 키도 개명을 따라간다. 값만 새 키로 옮기고 숨김 상태를 두고 오면, 사용자가 감춰 둔 칸이
 * 템플릿 개편 후 혼자 다시 나타난다 — 게다가 `normalizeHiddenKeys` 는 모르는 키를 버리지 않아
 * 옛 키가 저장분에 영원히 남는다(FRT-210, Codex P2).
 */
function applyRenamedHiddenKeys(keys: string[], typeId: ExperienceTypeId): string[] {
  // 순수 개명뿐 아니라 **유형 스코프 이관도 같은 자리 옮김**이다 — 확정본이 라벨과 선택지를 갈았어도
  // 묻는 질문은 그대로라(FRT-211 의 '개명 vs 대체') 사용자가 치워 둔 칸은 치워진 채로 있어야 한다.
  // 값 이관은 값 조건부지만 숨김 이관은 무조건이어도 안전하다 — 숨김은 빈 칸에만 허용되고
  // (`canHideBlock`), 목적지에 값이 생기면 `resolveHiddenBlocks` 가 자동으로 되돌려 보여준다.
  const scoped = new Map<string, string>()
  for (const { from, to } of [
    ...(SELECT_DOMAIN_MIGRATIONS[typeId] ?? []),
    ...(V2_CORE_SCOPED_MIGRATIONS[typeId] ?? []),
  ]) {
    scoped.set(from, to)
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const key of keys) {
    const mapped = RENAMED_FIELD_KEYS[key] ?? scoped.get(key) ?? key
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
    if (isBlockDiscardable(block)) continue
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
    hiddenKeys: applyRenamedHiddenKeys(parseHiddenKeys(content.hidden), typeId),
    importance: isImportanceLevel(exp.importance) ? exp.importance : undefined,
    createdAt: exp.created_at,
    updatedAt: exp.updated_at,
  }

  // ── v2: 레지스트리 순서로 블록 재구성 + fields 값 주입 ──
  if (content.schema_version === SCHEMA_VERSION_V2 && hasTemplate(exp.type)) {
    // 개명된 구 키는 새 키 자리로 옮겨 놓고 시작한다 — 라벨이 바뀌었다는 이유로 사용자가 같은
    // 정보를 다시 타이핑하게 만들지 않는다(RENAMED_FIELD_KEYS).
    const tmpl = getTemplateForType(typeId)
    // 템플릿이 소비하는 키 → 블록. 도메인 교체 select 의 새 선택지를 읽는 데 쓰고,
    // 아래 orphan 판정의 consumedKeys 도 이 맵의 키 집합이다.
    const templateByKey = new Map<string, Block>()
    for (const b of tmpl.commonCore.blocks) if (b.key) templateByKey.set(b.key, b)
    for (const s of tmpl.extensions) for (const b of s.blocks) if (b.key) templateByKey.set(b.key, b)
    // 전역 개명 별칭 뒤에 유형 스코프 이관을 얹는다 — 순서가 규칙이다. 유형 섹션 쪽 값이 먼저
    // 목적지를 차지하고, 코어 잔재는 목적지가 비었을 때만 들어간다.
    const fields = applyScopedMigrations(
      applyRenamedKeys(content.fields ?? {}),
      [...(SELECT_DOMAIN_MIGRATIONS[typeId] ?? []), ...(V2_CORE_SCOPED_MIGRATIONS[typeId] ?? [])],
      templateByKey,
    )
    const coreBlocks = tmpl.commonCore.blocks.map(b => {
      if (b.key === TITLE_KEY) return { ...b, value: { type: "text", text: title } as BlockValue }
      if (b.key === SUMMARY_KEY) return { ...b, value: { type: "text", text: summary } as BlockValue }
      return injectValue(b, b.key ? fields[b.key] : undefined)
    })
    const extensionBlocks = tmpl.extensions
      .flatMap(s => s.blocks)
      .map(b => injectValue(b, b.key ? fields[b.key] : undefined))
    // 템플릿이 소비한 키 집합. 그 밖의 fields 값은 구 템플릿 잔재이므로 custom 으로 보존한다.
    const consumedKeys = new Set(templateByKey.keys())
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
  // ⚠️ v1 은 저장 배열을 그대로 통과시키므로 손상 값이 무검증으로 들어온다 (FRT-200).
  // 아래 이관·dedup 로직이 곧바로 `isBlockDiscardable`(=isBlockEmpty)을 부르므로,
  // **여기서 즉시** 보정해야 한다 — 한 줄이라도 늦으면 그 판정에서 먼저 죽는다.
  // ⚠️ 템플릿 정의를 함께 넘긴다. v1 은 템플릿 병합이 **나중에**(ExperienceFormV2 →
  // mergeSavedIntoTemplate) 일어나는데, 여기서 결측 정의를 `[]` 로 굳혀 버리면 그 병합은
  // 빈 배열을 "사용자가 다 지웠다"로 읽어 현재 템플릿의 선택지·열을 되살리지 못한다 —
  // 값은 남는데 그릴 컨트롤이 없는 칸이 된다.
  const defsOf = templateDefsResolver(exp.type, typeId)
  const savedCore = normalizeBlocks(content.coreBlocks ?? [], defsOf)
  const savedExt = normalizeBlocks(content.extensionBlocks ?? [], defsOf)
  const savedCustom = normalizeBlocks(content.customBlocks ?? [], defsOf)

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
  // 선택지 도메인이 교체된 필드는 v1 에서도 v2 와 **같은 값 조건부 판정**을 받는다
  // (SELECT_DOMAIN_MIGRATIONS). v1 은 라벨로 매칭하므로 새 템플릿 블록을 라벨로 찾아 둔다.
  const domainMigratedByLabel = new Map<string, Block>()
  const domainMigratedByKey = new Map<string, Block>()
  for (const { from, to } of SELECT_DOMAIN_MIGRATIONS[typeId] ?? []) {
    const tb = extTemplateByKey.get(to)
    if (!tb) continue
    domainMigratedByKey.set(from, tb)
    domainMigratedByLabel.set(tb.label, tb)
    // ⚠️ 목적지 라벨만 색인하면 **라벨이 바뀐 규칙에는 조회가 빗나간다.** 선행 유형은 선택지만
    // 갈리고 라벨은 그대로여서 목적지 라벨 == 저장 라벨이었지만, 창작물은 '분야'→'유형 / 매체'로
    // 라벨까지 갈렸다(FRT-267 Codex P2). 구 키에서 원래 라벨을 뽑아 함께 색인한다 — 안 하면
    // 값이 새 목록에 그대로 있는데도 '기타'로 밀리고 required 칸은 빈 채 남아, 사용자가 바뀐 것도
    // 없는 답을 다시 골라야 저장된다.
    const sourceLabel = from.slice(from.indexOf('.') + 1)
    if (sourceLabel) domainMigratedByLabel.set(sourceLabel, tb)
  }
  // 타입이 호환되지 않는 매칭은 키를 붙이지 않고 '기타' 로 보낸다(isInjectableInto).
  const keyedExt = savedExt.map(b => {
    // 도메인 교체 select 는 값이 새 목록에 남아 있을 때만 싣고, 그때 선택지를 템플릿 것으로 바꾼다.
    const domainTb =
      (b.key ? domainMigratedByKey.get(b.key) : undefined) ?? domainMigratedByLabel.get(b.label)
    const carried = domainTb ? carrySelectValue(domainTb, b.value) : null
    const injectable = (key: string | undefined) => {
      if (domainTb) return !!carried && key === domainTb.key
      const tb = key ? extTemplateByKey.get(key) : undefined
      return !!tb && isInjectableInto(tb.type, b.type)
    }
    /** 매칭이 성사된 블록에는 정규화한 값을 실어 옛 선택지 목록이 따라오지 않게 한다. */
    const matched = (block: Block): Block => (carried ? { ...block, value: carried } : block)
    if (b.key) {
      // 도메인 교체 규칙도 개명과 같은 자리에서 키를 갈아준다 — 값이 새 목록에 남았을 때만
      // `injectable` 이 통과하므로, 못 옮길 값은 여기서 키가 갈려도 곧바로 blocked 로 떨어진다.
      const renamed = RENAMED_FIELD_KEYS[b.key] ?? domainMigratedByKey.get(b.key)?.key
      const keyed = renamed && !claimedKeys.has(renamed) ? { ...b, key: renamed } : b
      // 현재 템플릿이 그 키를 갖고 있는데 값을 못 실으면 매칭을 포기한다 — 저장 왕복 때 사라진다.
      const blocked = !!keyed.key && extTemplateKeys.has(keyed.key) && !injectable(keyed.key)
      return { block: blocked ? { ...keyed, key: undefined } : matched(keyed), blocked }
    }
    const current = extKeyByLabel[b.label]
    if (current) {
      return injectable(current)
        ? { block: matched({ ...b, key: current }), blocked: false }
        : { block: { ...b, key: undefined }, blocked: true }
    }
    // 키 없는 v1 블록은 라벨이 유일한 단서다 — 개명 별칭이 없으면 도메인 교체 목적지를 쓴다.
    const alias = renamedExtKeys[b.label] ?? domainTb?.key
    const usable = !!alias && !claimedKeys.has(alias) && injectable(alias)
    return { block: usable ? matched({ ...b, key: alias }) : { ...b, key: undefined }, blocked: false }
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
    else if (!isBlockDiscardable(b)) orphanExt.push(b)
  }

  // v2 는 `applyScopedMigrations` 로 코어 잔재를 확정본 목적지로 옮기지만, v1 은 저장 배열을
  // 그대로 통과시켜 그 이관이 통째로 빠져 있었다. "값이 사라지진 않으니 괜찮다"고 미뤄 뒀는데
  // **틀린 근거였다 — 값 유실보다 나쁜 것이 무음 오염이다.** 코어 원본이 살아 있는 채로 폼이
  // 확정본 칸을 materialize 하면 권위 있는 칸이 둘이 되고, 발행(`pickValue`)은 정확 라벨인 코어
  // 쪽을 먼저 골라 **사용자가 새 칸에 고쳐 쓴 값 대신 옛 값을 내보낸다**(FRT-267 Codex P2).
  // v2 에서 이미 고친 것과 같은 기전이다 — 한쪽만 고치면 레코드 세대에 따라 결과가 갈린다.
  //
  // 이관에 성공한 코어 블록은 **현재 템플릿에 그 라벨이 남아 있으면 빈 템플릿 블록으로 되돌리고**
  // (v2 가 `delete fields[from]` 뒤 템플릿에서 다시 짜는 것과 같은 결과 — 빈 코어는 dedup 이 숨긴다),
  // `CORE_EXCLUDE` 로 사라진 라벨이면 뺀다. 원본을 남기면 이관해 놓고 칸을 둘로 만드는 셈이다.
  const coreTemplateByLabel = new Map(tmpl.commonCore.blocks.map(b => [b.label, b]))
  /** 이관된 코어 블록 → 그 자리에 남길 빈 템플릿 블록(`undefined` 면 제거). */
  const consolidatedCore = new Map<Block, Block | undefined>()
  for (const { from, to, carry } of V2_CORE_SCOPED_MIGRATIONS[typeId] ?? []) {
    const tb = extTemplateByKey.get(to)
    if (!tb) continue
    const fromLabel = from.slice(from.indexOf('.') + 1)
    const source = savedCore.find(b => (b.key ? b.key === from : b.label === fromLabel))
    if (!source || isBlockDiscardable(source)) continue
    const carried = carry(tb, source.value)
    if (!carried) continue
    // 목적지가 이미 차 있으면 코어 잔재는 넣지 않는다(v2 와 같은 우선순위 — 유형 섹션 쪽이 먼저다).
    const idx = matchedExt.findIndex(b => b.key === to)
    if (idx >= 0 && !isBlockDiscardable(matchedExt[idx])) continue
    // ⚠️ 값을 그냥 얹지 않고 `injectValue` 를 태운다 — v2 는 코어를 다시 짜며 이 함수를 거쳐
    // text↔textarea 를 목적지 타입으로 **변환**하는데, v1 만 원본 타입을 그대로 실으면 같은
    // 이관인데 저장된 값의 타입이 세대별로 갈린다(위젯이 textarea 로 렌더돼 확정본과 어긋난다).
    const dest = injectValue(cloneBlocks([tb])[0], carried)
    if (idx >= 0) matchedExt[idx] = dest
    else matchedExt.push(dest)
    const coreTpl = coreTemplateByLabel.get(source.label)
    consolidatedCore.set(source, coreTpl ? cloneBlocks([coreTpl])[0] : undefined)
  }

  // v2 는 코어를 현재 템플릿에서 다시 짜므로 `CORE_EXCLUDE` 가 저절로 적용되지만, v1 은 저장된
  // 코어 배열을 그대로 통과시켜 **확정본이 뺀 칸이 되살아난다.** 빈 코어 '증빙 자료' 하나가
  // `computeFormCards` 에서 dedup 없이 evidence 버킷으로 직행해(코어 증빙은 항상 그 카드에 넣는다)
  // 2카드 설계인 유형에 **쓸모없는 세 번째 카드**를 만든다 — 채울 것도 없는 카드라 진행도만 막는다.
  // (창작물만의 문제가 아니다 — 봉사·해외경험 등 `CORE_EXCLUDE` 를 쓰는 유형 전부가 같았다.)
  //
  // ⚠️ **버릴 수 있는 것만 버린다.** 값이 든 코어 블록은 확정본이 그 칸을 뺐더라도 남긴다 — 사용자가
  // 적어 둔 것을 화면에서 지우는 쪽이 카드 하나 더 뜨는 것보다 훨씬 나쁘다(`orphanExt` 승격 기준과 같다).
  // 판정에 `isBlockEmpty` 가 아니라 `isBlockDiscardable` 을 쓰는 이유가 여기 있다: 파일 없이 설명·
  // 증빙 유형만 적어 둔 증빙 블록은 `isBlockEmpty` 로 **비어 있어서**, 그 기준으로 버리면 사용자가
  // 입력한 메타데이터가 다음 저장에 영구 삭제된다(FRT-267 Codex P2).
  const currentCoreLabels = new Set(coreTemplateByLabel.keys())
  const liveCore = savedCore.flatMap(b => {
    if (consolidatedCore.has(b)) {
      const replacement = consolidatedCore.get(b)
      return replacement ? [replacement] : []
    }
    return currentCoreLabels.has(b.label) || !isBlockDiscardable(b) ? [b] : []
  })

  return {
    ...base,
    coreBlocks: liveCore.map(b => {
      const keyed = b.key ? b : { ...b, key: coreKeyByLabel[b.label] }
      // 확정본이 증빙 유형 선택지를 정한 유형(CORE_EVIDENCE_OPTIONS)은 코어 '증빙 자료' 블록이
      // `options` 를 들고 있어야 `FileBlock` 이 드롭다운을 그린다. v2 는 코어를 템플릿에서 다시 짜
      // 저절로 받지만 v1 은 저장 배열을 그대로 통과시켜 **같은 유형인데 세대에 따라 드롭다운과
      // 자유 입력으로 갈린다**(FRT-269 Codex P2). 저장값이 아니라 화면 메타데이터라 덮어도 안전하다.
      const options = coreTemplateByLabel.get(keyed.label)?.options
      return options && !keyed.options ? { ...keyed, options } : keyed
    }),
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
