import type {
  Block,
  BlockType,
  BlockValue,
  BlockRow,
  BlockColumnDef,
  CellValue,
  FileCellValue,
  ProjectLinkConfig,
  RowArtifact,
  SectionCategory,
} from '@/types/archive'

let _counter = 0
export function uid(prefix = 'blk'): string {
  _counter += 1
  return `${prefix}-${Date.now()}-${_counter}`
}

// ─── Empty value factories ──────────────────────────────────────

function emptyValue(type: Exclude<BlockType, 'group'>, opts?: { options?: string[]; columns?: BlockColumnDef[] }): BlockValue {
  switch (type) {
    case 'text':
      return { type: 'text', text: '' }
    case 'textarea':
      return { type: 'textarea', text: '' }
    case 'checklist':
      return { type: 'checklist', options: opts?.options ?? [], checked: [] }
    case 'single-select':
      return { type: 'single-select', options: opts?.options ?? [], selected: '' }
    case 'date':
      return { type: 'date', date: '' }
    case 'period':
      return { type: 'period', start: '', end: '', isCurrent: false }
    case 'tags':
      return { type: 'tags', tags: [] }
    case 'link':
      return { type: 'link', url: '', title: '', description: '', linkType: '' }
    case 'file':
      return { type: 'file', fileName: '', description: '', evidenceType: '' }
    case 'repeatable-cell':
      // `??` 가 아니라 배열인지로 고른다 — 정의도 저장분에서 올 수 있고, 배열이 아닌 값이
      // 실리면 `RepeatableCellBlock` 의 `columns.map` 이 그 자리에서 죽는다.
      return { type: 'repeatable-cell', columns: Array.isArray(opts?.columns) ? opts.columns : [], rows: [] }
    case 'table':
      return { type: 'table', columns: [], rows: [] }
  }
}

/**
 * 이 코드가 아는 블록 타입인가.
 *
 * ⚠️ **목록을 `Record<BlockType, true>` 로 적는 이유**: 새 타입이 union 에 추가되면 컴파일러가
 * 여기 누락을 잡는다. 목록이 조용히 뒤처지면 새 타입 값이 "모르는 타입"으로 분류돼
 * `isBlockDiscardable` 에서 버려진다 — 즉 새 스키마가 쓴 값을 구 프론트가 지운다.
 */
const KNOWN_BLOCK_TYPES: Record<BlockType, true> = {
  text: true,
  textarea: true,
  checklist: true,
  'single-select': true,
  date: true,
  period: true,
  tags: true,
  link: true,
  file: true,
  'repeatable-cell': true,
  table: true,
  group: true,
}

/** 카드 배분이 `buckets[b.category ?? 'detail']` 로 찾으므로, 모르는 값이면 그 자리에서 죽는다. */
const KNOWN_SECTION_CATEGORIES: Record<SectionCategory, true> = {
  basic: true,
  detail: true,
  repeat: true,
  evidence: true,
}

const isKnownCategory = (c: unknown): c is SectionCategory =>
  typeof c === 'string' && Object.prototype.hasOwnProperty.call(KNOWN_SECTION_CATEGORIES, c)

export function isKnownBlockType(t: unknown): t is BlockType {
  return typeof t === 'string' && Object.prototype.hasOwnProperty.call(KNOWN_BLOCK_TYPES, t)
}

// ─── Block factories ────────────────────────────────────────────

export function createBlock(
  type: Exclude<BlockType, 'group'>,
  label: string,
  opts?: {
    required?: boolean
    placeholder?: string
    guide?: string
    options?: string[]
    columns?: BlockColumnDef[]
    collapsed?: boolean
  },
): Block {
  return {
    id: uid(),
    type,
    label,
    required: opts?.required,
    collapsed: opts?.collapsed,
    placeholder: opts?.placeholder,
    guide: opts?.guide,
    options: opts?.options,
    value: emptyValue(type, opts),
  }
}

export function createTextField(label: string, opts?: { required?: boolean; placeholder?: string; guide?: string }): Block {
  return createBlock('text', label, opts)
}

export function createTextareaField(label: string, opts?: { required?: boolean; placeholder?: string; guide?: string }): Block {
  return createBlock('textarea', label, opts)
}

export function createDateField(label: string, opts?: { required?: boolean; guide?: string }): Block {
  return createBlock('date', label, opts)
}

export function createPeriodField(label: string, opts?: { required?: boolean; guide?: string }): Block {
  return createBlock('period', label, opts)
}

export function createSelectField(
  label: string,
  options: string[],
  opts?: { required?: boolean; guide?: string },
): Block {
  return createBlock('single-select', label, { ...opts, options })
}

export function createChecklistField(
  label: string,
  options: string[],
  opts?: { required?: boolean; guide?: string },
): Block {
  return createBlock('checklist', label, { ...opts, options })
}

/**
 * 이모티콘 알약 태그 입력(FRT-177). 저장은 `checklist {options, checked}` 그대로 두고
 * `variant: 'mood-tag'` 마커로 MoodTagBlock UI 를 지정한다(무마이그레이션, OutcomeList 와 같은 패턴).
 * 옵션은 기획 확정본이 정한 고정 프리셋이라 체크리스트의 옵션 추가·삭제 UI 를 노출하지 않는다 —
 * 사용자가 프리셋 태그를 지워버리면 되돌릴 방법이 없기 때문이다.
 */
export function createMoodTagField(
  label: string,
  options: string[],
  opts?: { required?: boolean; guide?: string },
): Block {
  return { ...createChecklistField(label, options, opts), variant: 'mood-tag' }
}

export function createTagsField(label: string, opts?: { required?: boolean; guide?: string }): Block {
  return createBlock('tags', label, opts)
}

export function createLinkField(label: string, opts?: { required?: boolean; placeholder?: string; guide?: string }): Block {
  return createBlock('link', label, opts)
}

/**
 * 증빙 파일 첨부. FileBlockValue 는 파일 자체 외에 설명·증빙 유형을 함께 담으므로
 * '파일 설명'·'증빙 유형'을 별도 블록으로 만들면 같은 입력칸이 두 벌 생긴다.
 * `options` 를 주면 증빙 유형이 자유 입력 대신 드롭다운이 된다(FRT-179 자격증) — 유형마다
 * 고를 수 있는 증빙이 다르므로 템플릿이 정한다. 안 주면 기존대로 자유 입력이다.
 */
export function createFileField(
  label: string,
  opts?: { required?: boolean; guide?: string; options?: string[] },
): Block {
  return createBlock('file', label, opts)
}

/**
 * 템플릿 정의용 표형 반복 입력. 템플릿 표는 컬럼이 고정이므로 `lockColumns` 가 기본 켜짐이다(FRT-104) —
 * 열 태그·'열 추가' UI 가 숨는다. 열을 자유롭게 추가하는 표가 필요하면 `{ lockColumns: false }`.
 * 사용자가 직접 만드는 커스텀 표는 이 팩토리가 아니라 `createBlock` 을 거치므로 잠기지 않는다.
 *
 * `allowRowExtras` 를 켜면 각 행에 '항목 추가' 가 붙는다(FRT-145). 열 잠금과 함께 켤 수 있다 —
 * 열은 계속 템플릿이 소유하고, 그건 행 하나에만 붙는 항목이라 서로 간섭하지 않는다.
 */
export function createRepeatableCell(
  label: string,
  columns: BlockColumnDef[],
  opts?: {
    collapsed?: boolean
    lockColumns?: boolean
    guide?: string
    allowRowExtras?: boolean
    /** 각 행에 결과물(링크·파일·설명)을 여러 건 붙인다 (FRT-291). */
    allowRowArtifacts?: boolean
  },
): Block {
  const base = createBlock('repeatable-cell', label, {
    columns,
    collapsed: opts?.collapsed,
    guide: opts?.guide,
  })
  return {
    ...base,
    lockColumns: opts?.lockColumns ?? true,
    // 끈 블록에 키를 남기지 않는다 — 템플릿 스냅샷 비교(toEqual)에 잡음이 된다.
    ...(opts?.allowRowExtras ? { allowRowExtras: true } : {}),
    ...(opts?.allowRowArtifacts ? { allowRowArtifacts: true } : {}),
  }
}

export function createTableField(label: string): Block {
  return createBlock('table', label)
}

/**
 * 개조식 불릿-행 입력(FRT-97). 저장은 단일컬럼 `repeatable-cell` 그대로 두고
 * `variant: 'outcome-list'` 마커로 OutcomeList UI 를 지정한다(무마이그레이션).
 * 컬럼 key 는 `'item'` 고정 — OutcomeList 가 이 키의 텍스트를 각 행 값으로 읽는다.
 * `itemLabel` 은 '+ ○○ 추가' 버튼 문구가 되는 컬럼 라벨(기본 '활동 / 성과').
 * `link` 를 주면(FRT-76) 각 행에 '프로젝트로 연결' 버튼이 붙는다(인스턴스별 opt-in·문구 설정).
 * 컬럼은 잠그지 않는다(FRT-104) — 사용자가 열을 추가한 레거시 값은 BlockRenderer 가 표형으로
 * 폴백하는데, 거기서 열 관리까지 막으면 추가된 열을 되돌릴 방법이 사라진다.
 */
export function createOutcomeList(
  label: string,
  opts?: {
    placeholder?: string
    guide?: string
    itemLabel?: string
    link?: ProjectLinkConfig
    /** 각 행에 역할 태그 칩을 붙인다(FRT-178). `link` 와 같은 인스턴스별 opt-in. */
    roleTags?: boolean
  },
): Block {
  const base = createRepeatableCell(label, [
    { key: 'item', label: opts?.itemLabel ?? '활동 / 성과', blockType: 'text', placeholder: opts?.placeholder },
  ], { lockColumns: false })
  return {
    ...base,
    variant: 'outcome-list',
    guide: opts?.guide,
    ...(opts?.link ? { linkConfig: opts.link } : {}),
    ...(opts?.roleTags ? { roleTags: true } : {}),
  }
}

/**
 * 역할 이력 입력(FRT-178). 저장은 3컬럼 `repeatable-cell`(`start`/`end`/`role`) 그대로 두고
 * `variant: 'role-history'` 마커로 접이식 패널 UI 를 지정한다(무마이그레이션, OutcomeList 와 같은 패턴).
 * 이 블록의 `role` 값들이 폼 안 모든 역할 칩의 선택지가 된다 — 선택지가 상수가 아니라
 * 형제 블록의 값에서 파생되는 유일한 경우라, 파생·전파는 RoleHistoryContext 가 맡는다.
 * 컬럼은 잠근다(lockColumns) — 이력 표에 사용자가 열을 더하면 파생 규칙이 성립하지 않는다.
 */
export function createRoleHistory(label: string, opts?: { guide?: string }): Block {
  const base = createRepeatableCell(
    label,
    [
      { key: 'start', label: '시작', blockType: 'period', placeholder: 'YYYY-MM' },
      { key: 'end', label: '종료', blockType: 'period', placeholder: 'YYYY-MM' },
      { key: 'role', label: '역할명', blockType: 'text', placeholder: '역할명 (예: 공연팀장)' },
    ],
    { guide: opts?.guide },
  )
  return { ...base, variant: 'role-history' }
}

/** `createRoleHistory` 블록에서 등록된 역할명을 순서대로 뽑는다(공백 제거·중복 제거). */
export function roleNamesOf(block: Block): string[] {
  if (block.value.type !== 'repeatable-cell') return []
  const out: string[] = []
  for (const row of block.value.rows) {
    const name = cellText(row.cells['role']).trim()
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/**
 * 이 블록에 붙어 있는 역할 태그를 모두 `fn` 으로 바꾼 사본을 돌려준다 (FRT-178).
 * 대상은 두 곳뿐이다 — OutcomeList 행의 `roleTags`, `variant: 'role-chip'` 컬럼의 셀.
 * '역할 이력' 블록 자신의 `role` 컬럼은 variant 가 없어 건드리지 않는다(이미 편집된 원본이다).
 * 바뀐 게 없으면 **같은 참조**를 돌려준다 — 이름 하나 고칠 때마다 폼 전체가 리렌더되지 않도록.
 */
export function mapRoleTags(block: Block, fn: (tags: string[]) => string[]): Block {
  if (block.type === 'group') {
    const children = block.children?.map(c => mapRoleTags(c, fn))
    const changed = children?.some((c, i) => c !== block.children?.[i])
    return changed ? { ...block, children } : block
  }
  if (block.value.type !== 'repeatable-cell') return block

  const roleCols = block.value.columns.filter(c => c.variant === 'role-chip').map(c => c.key)
  let touched = false
  const rows = block.value.rows.map(row => {
    let next = row
    if (Array.isArray(row.roleTags)) {
      const mapped = fn(row.roleTags)
      if (mapped.length !== row.roleTags.length || mapped.some((t, i) => t !== row.roleTags?.[i])) {
        next = { ...next, roleTags: mapped }
      }
    }
    for (const key of roleCols) {
      const cell = row.cells[key]
      const tags = Array.isArray(cell) ? cell : []
      const mapped = fn(tags)
      if (mapped.length !== tags.length || mapped.some((t, i) => t !== tags[i])) {
        next = { ...next, cells: { ...next.cells, [key]: mapped } }
      }
    }
    if (next !== row) touched = true
    return next
  })

  return touched ? { ...block, value: { ...block.value, rows } } : block
}

/** 역할명 치환기. `to` 가 비면 제거로 동작한다(이름을 지워 빈 칸이 된 경우). */
export function renameRoleTag(from: string, to: string): (tags: string[]) => string[] {
  const next = to.trim()
  return tags => {
    if (!tags.includes(from)) return tags
    const replaced = next ? tags.map(t => (t === from ? next : t)) : tags.filter(t => t !== from)
    // 이미 같은 이름이 붙어 있던 행에서 중복이 생기지 않게 한다.
    return replaced.filter((t, i) => replaced.indexOf(t) === i)
  }
}

/** 역할명 제거기. */
export function removeRoleTag(name: string): (tags: string[]) => string[] {
  return tags => (tags.includes(name) ? tags.filter(t => t !== name) : tags)
}

export function createGroupBlock(label: string): Block {
  return {
    id: uid('grp'),
    type: 'group',
    label,
    children: [],
    collapsed: false,
    value: { type: 'group' },
  }
}

// ─── Row helpers ────────────────────────────────────────────────

export function createEmptyRow(columns: BlockColumnDef[]): BlockRow {
  const cells: Record<string, CellValue> = {}
  for (const col of columns) {
    if (col.blockType === 'checklist' || col.blockType === 'tags') {
      cells[col.key] = []
    } else {
      cells[col.key] = ''
    }
  }
  return { id: uid('row'), cells }
}

// ─── Deep clone ─────────────────────────────────────────────────

export function cloneBlock(block: Block): Block {
  const result: Block = { ...JSON.parse(JSON.stringify(block)), id: uid() }
  if (result.type === 'group' && result.children) {
    // Children are leaves (1-level cap). The JSON deep-clone above already deep-copied
    // their values; just assign fresh ids without another full serialize pass.
    result.children = result.children.map((c: Block) => ({ ...c, id: uid() }))
  }
  return result
}

export function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map(cloneBlock)
}

// ─── Validation ─────────────────────────────────────────────────

/** 이 셀 값이 파일 셀인가 (FRT-213). `string[]` 도 typeof 'object' 라 배열을 먼저 걸러낸다. */
export function isFileCellValue(cell: CellValue | undefined): cell is FileCellValue {
  return typeof cell === 'object' && cell !== null && !Array.isArray(cell) && cell.type === 'file'
}

// 반복 입력 셀 하나가 실제로 채워졌는지. block-utils 는 types 만 import 하는 leaf 라
// 순환 걱정 없이 여기서 export 하고 form-cards·usePlaceholderRow 가 재사용한다(단일 출처).
export function cellFilled(cell: CellValue | undefined): boolean {
  // 저장된 셀은 null 로도 온다(FRT-200) — `undefined` 만 걸러내면 아래 `.trim()` 에서 죽는다.
  if (cell === undefined || cell === null) return false
  // 파일은 업로드가 끝나야(fileId 확보) 채워진 것이다 — 이름만 있는 건 실패한 첨부다.
  // ⚠️ `isFileCellValue` 는 `type` 만 보고 통과시키므로 `fileId` 가 문자열이라는 보장이 없다 —
  // 셀 **안쪽**도 깨진 채 저장될 수 있어 `.trim()` 을 직접 부르면 안 된다(FRT-200 리뷰).
  // 불투명 셀(모르는 판별자)은 **내용이 있다**고 본다 — 비었다고 보면 버림 판정에서 사라진다.
  if (isOpaqueCell(cell)) return true
  if (isFileCellValue(cell)) return isFilledText(cell.fileId)
  return Array.isArray(cell) ? cell.length > 0 : isFilledText(cell)
}

/**
 * 셀 값을 사람이 읽는 한 줄 텍스트로 접는다 (FRT-213).
 *
 * 셀 값을 텍스트로 펴는 로직이 6곳(포트폴리오 평탄화·역할이력·개조식 목록·역할명 수집·
 * 프로젝트 연결·readOnly 렌더)에 흩어져 중복돼 있던 것을 단일 출처로 모은 것이다.
 * 파일 셀은 구조화 객체라 이 함수가 없으면 `.trim()` 에서 런타임 오류가 난다.
 *
 * ⚠️ 반복 블록의 file 컬럼 렌더는 이 함수를 쓰지 않는다 — 다운로드까지 되는 카드를 그린다.
 * 이 함수는 파일을 모르는 제네릭 소비처가 최소한 안전하게 텍스트로 접을 때 쓴다.
 */
export function cellText(cell: CellValue | undefined): string {
  // `cellFilled` 과 같은 이유로 null 도 함께 걸러낸다 — 두 함수의 기준이 어긋나면 안 된다(FRT-200).
  if (cell === undefined || cell === null) return ""
  if (isFileCellValue(cell)) {
    // 첨부를 지우면 `{fileId:"", fileName:""}` 이 남는다 — 이걸 대체 문구로 접으면 없는 첨부가
    // 화면에 남고, 열 유형이 텍스트로 바뀌면 그 문구가 값으로 굳는다. `cellFilled` 과 같은
    // 기준(fileId)으로 판정해 두 함수가 어긋나지 않게 한다(결측 방어도 같은 기준, FRT-200).
    if (!isFilledText(cell.fileId)) return ""
    // 파일명이 비면 첨부했다는 사실 자체가 화면에서 사라진다 — 대체 문구로 흔적을 남긴다.
    return isFilledText(cell.fileName) ? cell.fileName.trim() : "첨부파일"
  }
  return Array.isArray(cell) ? cell.join(", ") : typeof cell === "string" ? cell : ""
}

/**
 * 반복 입력 행 하나에 사용자가 남긴 내용이 있는지. 셀뿐 아니라 그 행에만 붙은 항목
 * (`extraFields`, FRT-145)과 결과물 첨부(`artifacts`, FRT-291)까지 본다 — 셀만 보면 그쪽에만
 * 값을 쓴 행이 '빈 행'으로 판정돼 상세뷰에서 통째로 사라진다(유령 행 필터가 사용자 값을 숨기는 형태).
 * 빈 판정을 하는 세 곳(isBlockEmpty · RepeatableCellBlock readOnly · 진행도)이 이 함수를 공유한다.
 */
export function rowHasContent(row: BlockRow): boolean {
  // 저장된 행에 `cells` 가 아예 없을 수 있다(FRT-200) — `Object.values(undefined)` 는 던진다.
  if (!row || typeof row !== 'object') return false
  const cells = row.cells && typeof row.cells === 'object' ? row.cells : {}
  // ⚠️ 이 판정은 **보정 전 원본**에도 돈다(`orphanFieldsToBlocks` 가 날것을 넘긴다) — 컬렉션이
  // 배열이 아니거나 원소가 null 이면 여기서 던지고, 정규화가 손쓸 새도 없이 화면이 죽는다.
  const extras = Array.isArray(row.extraFields) ? row.extraFields : []
  // 행 첨부(FRT-291)도 같은 이유로 배열인지부터 묻는다 — 새로 만든 그릇이라고 해서 날것이
  // 안 오는 게 아니다. 위 두 줄의 규칙을 세 번째 컬렉션에도 그대로 적용한다.
  const artifacts = Array.isArray(row.artifacts) ? row.artifacts : []
  return (
    Object.values(cells).some(cellFilled) ||
    extras.some(f => !!f && typeof f === 'object' && cellFilled((f as { value?: CellValue }).value)) ||
    artifacts.some(a => !!a && typeof a === 'object' && artifactFilled(a))
  )
}

/**
 * 행 첨부 한 건에 사용자가 남긴 것이 있는지 (FRT-291).
 *
 * ⚠️ 설명만 적고 링크·파일이 아직 없는 첨부도 **채워진 것으로 본다.** `cellFilled` 이 파일을
 * `fileId` 로 판정하는 것과 같은 이유의 반대편이다 — 여기서 설명을 무시하면 사용자가 적어 둔
 * 문장이 '빈 첨부'로 판정돼 다음 저장에 사라진다(FRT-267 ⑰ "버림 판정에는 전용 술어를").
 *
 * ⚠️ 문자열 여부는 `isFilledText` 로만 묻는다 — 이 판정도 **보정 전 원본**에 도달하므로
 * `.trim()` 을 직접 부르면 저장 값이 숫자·객체로 왔을 때 목록이 통째로 죽는다(FRT-200).
 */
export function artifactFilled(a: RowArtifact): boolean {
  if (!a || typeof a !== 'object') return false
  const file = a.file && typeof a.file === 'object' ? a.file : undefined
  return isFilledText(a.url) || isFilledText(a.desc) || isFilledText(file?.fileId)
}

/** 빈 행 첨부 한 건. */
export function createEmptyArtifact(): RowArtifact {
  return { id: uid('art') }
}

/**
 * ⚠️ **저장된 값은 타입이 약속한 모양대로 오지 않는다** (FRT-200).
 * `Block.value` 는 non-nullable 로 선언돼 있지만 실제 값은 서버 JSONB 를 역직렬화한 것이라
 * null 이거나 필드가 빠진 채 도착할 수 있다. 이 판정은 **모든 블록에 대해** 돌고
 * 상세뷰·조건부노출·숨김·이관·포트폴리오가 공유하므로, 여기서 한 번 던지면 화면이 통째로 죽는다.
 * 그래서 문자열은 `isFilledText`, 배열은 `Array.isArray` 로만 묻는다 — `.trim()` 을 직접 부르지 않는다.
 */
export function isBlockEmpty(block: Block): boolean {
  const v = block.value as BlockValue | null | undefined
  if (!v || typeof v !== 'object') return true
  switch (v.type) {
    case 'text':
    case 'textarea':
      return !isFilledText(v.text)
    case 'date':
      return !isFilledText(v.date)
    case 'period':
      return !isFilledText(v.start) && !isFilledText(v.end)
    case 'single-select':
      return !isFilledText(v.selected)
    case 'checklist':
      return !Array.isArray(v.checked) || v.checked.length === 0
    case 'tags':
      return !Array.isArray(v.tags) || v.tags.length === 0
    case 'link':
      return !isFilledText(v.url)
    case 'file':
      return !isFilledText(v.fileName) && !isFilledText(v.fileId) && !isFilledText(v.url)
    case 'repeatable-cell':
      // 행이 없거나, 모든 행의 모든 셀이 비어 있으면 empty (FRT-122). 빈 행 하나(방금 '+ 추가'
      // 하거나 placeholder 에 한 글자 썼다 지운 실체화 행)를 non-empty 로 오판해 상세뷰·포트폴리오에
      // '—'만 있는 유령 섹션이 남던 문제를 판정 층위에서 고친다(value/rows 는 그대로 둔다 —
      // 행을 지우면 placeholder 리마운트로 포커스가 날아간다).
      return !Array.isArray(v.rows) || !v.rows.some(rowHasContent)
    case 'table':
      return !Array.isArray(v.rows) || v.rows.length === 0
    case 'group':
      return (block.children ?? []).every(c => isBlockEmpty(c))
    default:
      // 이 코드가 모르는 type(구 스키마 잔재·새 스키마가 쓴 값)은 그릴 것이 없다고 본다.
      // ⚠️ **"버려도 된다"는 뜻이 아니다.** 이 판정을 그대로 버림 근거로 쓰면 못 그린다는
      // 이유로 남의 데이터를 지운다 — 그 경계는 `isBlockDiscardable` 이 따로 친다 (FRT-200).
      return true
  }
}

/**
 * ⚠️ **저장된 값은 타입이 약속한 모양대로 오지 않는다.** `injectValue`(experience-mapper) 는
 * `content.fields[key]` 를 `{...block, value}` 로 통째로 싣는데 `content` 는 서버 JSONB 라,
 * 부속 필드가 빠진 채 저장된 구 레코드가 그대로 블록 값이 된다. 이 판정은 모든 블록에 대해
 * 돌므로 여기서 `undefined.trim()` 이 나면 화면이 통째로 터진다.
 */
export function isFilledText(s: unknown): boolean {
  return typeof s === 'string' && s.trim() !== ''
}

/**
 * 이 코드가 모르는 **이름**을 든 판별자 — 새 스키마가 쓴 값일 수 있으니 지켜야 한다.
 *
 * ⚠️ **빈 문자열은 여기 들어오지 않는다.** `''`·공백은 아무 신원도 싣고 있지 않으므로
 * "내가 모르는 것"이 아니라 그냥 손상이다. 미지로 치면 저장은 지키고 렌더는 잠가서,
 * 사용자가 쓴 글자가 **보이지도 고쳐지지도 않는 칸**이 된다 — 지키는 게 아니라 가두는 것이다.
 * 신호가 없을 때는 대체 신호(`block.type`)로 되살린다.
 *
 * ⚠️ 셀·부가 항목(`isOpaqueCell`)은 **일부러 이 술어를 쓰지 않는다.** 그 경로에는 되살릴
 * 대체 신호(열 유형)가 인자로 오지 않아, 미지에서 빼는 순간 `repairCell` 이 곧장 `''` 로
 * 낮춘다. **복구 신호가 없는 자리에서 "신호 없음"은 보존이지 삭제가 아니다.**
 */
function isOpaqueType(t: unknown): boolean {
  return isFilledText(t) && !isKnownBlockType(t)
}

// ─── 손상된 저장 값 보정 (FRT-200) ───────────────────────────────

const asText = (x: unknown): string => (typeof x === 'string' ? x : '')

/**
 * 식별자 전용 — 숫자로 저장된 id 는 **글자로 살린다**.
 *
 * ⚠️ `asText` 로 버리면 `id: 5` 는 새 id 를 받고 그걸 가리키던 `linkedProjectRowId: 5` 는
 * 사라져, 런타임에선 멀쩡히 이어져 있던 링크가 **열었다 저장하는 것만으로 끊긴다**.
 */
const asIdText = (x: unknown): string =>
  typeof x === 'string' ? x : typeof x === 'number' && Number.isFinite(x) ? String(x) : ''

const asStrings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []

/**
 * 자리를 지키며 문자열로 맞춘다.
 *
 * ⚠️ **표의 열·셀은 위치가 곧 의미다.** `asStrings` 처럼 걸러 내면 뒤 원소가 앞으로 당겨져
 * **다른 열의 값이 된다** — 그대로 저장되므로 값 유실보다 나쁜 무음 오염이다.
 * 반대로 태그·체크 목록은 자리에 뜻이 없으니 걸러 내는 쪽이 맞다.
 */
const asStringsInPlace = (x: unknown): string[] =>
  Array.isArray(x) ? x.map(i => (typeof i === 'string' ? i : '')) : []

const allStrings = (x: unknown): boolean =>
  Array.isArray(x) && x.every(i => typeof i === 'string')

/** 선택 필드는 "문자열이거나 아예 없거나" — 깨진 값은 키째 지운다(빈 문자열도 값이므로). */
const optText = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined)
const isOptText = (x: unknown): boolean => x === undefined || typeof x === 'string'
const isOptNumber = (x: unknown): boolean => x === undefined || typeof x === 'number'

/**
 * 이 코드가 모르는 판별자를 든 셀 — **새 스키마가 쓴 잎 값**일 수 있다.
 *
 * ⚠️ **열 유형을 조건으로 걸지 않는다.** 한때는 열 유형까지 미지일 때만 지켰는데, 그러면
 * `text` 처럼 아는(또는 낡은) 열 밑의 새 스키마 값이 곧장 `''` 로 낮아져 **열었다 저장하는
 * 것만으로 영구히 사라진다.** 저장 경로는 열이 무엇이든 지키고, 그리기 위한 낮춤은 저장되지
 * 않는 렌더 관문(`lowerOpaqueLeaves`)이 맡는다.
 */
const isOpaqueCell = (c: unknown): boolean =>
  isPlainObject(c) && typeof c.type === 'string' && !isKnownBlockType(c.type)

/**
 * 셀 하나가 이 코드가 그릴 수 있는 모양인가 (문자열 · 문자열 배열 · 파일 셀).
 *
 * ⚠️ 배열은 **원소까지** 본다 — `TagsCellInput`·`RoleChips` 가 원소를 React 자식으로 그리므로
 * 객체가 하나만 섞여도 그 자리에서 화면이 죽는다.
 */
function isIntactCell(c: unknown): boolean {
  if (typeof c === 'string') return true
  if (Array.isArray(c)) return allStrings(c)
  if (isFileCellValue(c as CellValue)) {
    const f = c as Record<string, unknown>
    return typeof f.fileId === 'string' && typeof f.fileName === 'string' && isOptText(f.mimeType) && isOptNumber(f.size)
  }
  return false
}

function repairCell(c: unknown): CellValue {
  if (isOpaqueCell(c)) return c as CellValue
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return asStrings(c)
  if (isPlainObject(c) && c.type === 'file') {
    return {
      ...c,
      type: 'file',
      fileId: asText(c.fileId),
      fileName: asText(c.fileName),
      mimeType: optText(c.mimeType),
      size: typeof c.size === 'number' ? c.size : undefined,
    } as CellValue
  }
  return ''
}

/**
 * 열 정의는 `key` 만이 아니라 **렌더러가 읽는 필드 전부**가 성해야 한다 —
 * `RepeatableCellBlock` 이 `col.label` 을 그대로 그리고 셀 컨트롤이 `col.options` 를 읽는다.
 */
function isIntactColumn(c: unknown): boolean {
  if (!isPlainObject(c)) return false
  return (
    typeof c.key === 'string' &&
    typeof c.label === 'string' &&
    typeof c.blockType === 'string' &&
    isOptText(c.placeholder) &&
    isOptText(c.guide) &&
    isOptText(c.variant) &&
    (c.options === undefined || allStrings(c.options)) &&
    (c.required === undefined || typeof c.required === 'boolean')
  )
}

function repairColumn(c: Record<string, unknown>): BlockColumnDef {
  return {
    ...c,
    // ⚠️ 숫자 key 는 **글자로 살린다** — `5` 와 `"5"` 는 JSON 에서 같은 셀(`cells["5"]`)을
    // 가리키므로, 버리면 그 셀의 주인이 뒤 열로 넘어간다(앞엣것이 이름을 지킨다는 규칙과 어긋남).
    key: asIdText(c.key),
    label: asText(c.label),
    blockType: (typeof c.blockType === 'string' ? c.blockType : 'text') as BlockColumnDef['blockType'],
    placeholder: optText(c.placeholder),
    guide: optText(c.guide),
    variant: optText(c.variant) as BlockColumnDef['variant'],
    ...(c.options !== undefined ? { options: asStrings(c.options) } : {}),
    ...(c.required !== undefined ? { required: c.required === true } : {}),
  } as BlockColumnDef
}

/**
 * 이름표가 겹치면 그것으로 찾는 모든 조작이 두 개를 함께 잡는다 — 앞엣것을 두고 뒤엣것만 간다.
 * `uid()` 가 아니라 **결정적 규칙**이라야 같은 입력에서 늘 같은 결과가 나온다.
 */
function dedupeNames(
  names: string[],
  fallback: (i: number) => string,
  extraReserved: Set<string> = new Set(),
): string[] {
  // ⚠️ **저장된 이름을 먼저 예약한다.** 결측 항목이 앞에 있다고 폴백이 `row-0` 을 가져가면,
  // 뒤에 있는 **진짜 `row-0`** 이 밀려나고 그걸 가리키던 링크가 엉뚱한 행을 가리킨다.
  const reserved = new Set([...names.filter(Boolean), ...extraReserved])
  const used = new Set<string>()
  return names.map((raw, i) => {
    let name = raw
    if (!name) {
      const base = fallback(i)
      name = base
      for (let n = 1; used.has(name) || reserved.has(name); n += 1) name = `${base}-${n}`
    } else if (used.has(name)) {
      // 저장분끼리 겹치면 앞엣것이 그 이름을 지키고 뒤엣것만 간다.
      // ⚠️ 여기서 만드는 이름도 **저장된 이름을 피해야** 한다 — `x`,`x`,`x-1` 에서 중복이
      // `x-1` 을 가져가면 진짜 `x-1` 이 밀리고 그걸 가리키던 링크가 중복 행을 가리킨다.
      const base = name
      for (let n = 1; used.has(name) || reserved.has(name); n += 1) name = `${base}-${n}`
    }
    used.add(name)
    return name
  })
}

/**
 * 열 key 를 유일하게 만들고, **바뀐 key 의 옛 이름 → 새 이름** 표를 함께 돌려준다.
 *
 * ⚠️ 이름표만 갈면 값은 옛 이름 아래 남고 렌더러는 새 이름으로 찾는다 — 저장된 값이 화면에서
 * 사라진다. 셀도 같이 옮겨야 한다.
 */
/** 행들이 쓰고 있는 모든 셀 이름. 만들어 낼 열 key 가 이걸 피해야 남의 값을 안 가리킨다. */
function allCellKeys(rows: unknown): Set<string> {
  if (!Array.isArray(rows)) return new Set()
  const out = new Set<string>()
  for (const r of rows) {
    if (isPlainObject(r) && isPlainObject(r.cells)) Object.keys(r.cells).forEach(k => out.add(k))
  }
  return out
}

function repairColumns(
  raw: unknown,
  /** 행이 이미 쓰고 있는 셀 이름 — 만들어 낸 열 key 가 **남의 값을 가리키면 안 된다**. */
  cellKeys: Set<string> = new Set(),
): { columns: BlockColumnDef[]; renames: Map<string, string> } {
  const rawColumns = Array.isArray(raw) ? raw.filter(isPlainObject) : []
  const repaired = rawColumns.map(repairColumn)
  const keys = dedupeNames(repaired.map(c => c.key), i => `col-${i}`, cellKeys)
  // 옛 이름은 **저장된 원본** 기준이다(문자열이 아닐 수 있고, 셀은 그 이름 아래 있다).
  const oldKeys = rawColumns.map(r => (typeof r.key === 'string' ? r.key : String(r.key)))
  // ⚠️ 중복이면 **앞엣것이 그 이름을 지킨다** — 셀도 앞 열에 남아야 하므로 그 이름은 옮기지
  // 않는다. 표를 그대로 적용하면 하나뿐인 값이 뒤 열로 가서 소유자가 바뀐다.
  const kept = new Set(oldKeys.filter((k, i) => k === keys[i]))
  const renames = new Map<string, string>()
  oldKeys.forEach((oldKey, i) => {
    // 같은 옛 이름이 여럿이면 **첫 열이 그 셀을 갖는다** — 뒤엣것이 표를 덮어쓰면 소유자가 바뀐다.
    if (oldKey !== keys[i] && !kept.has(oldKey) && !renames.has(oldKey)) renames.set(oldKey, keys[i])
  })
  return {
    columns: repaired.map((c, i) => (c.key === keys[i] ? c : { ...c, key: keys[i] })),
    renames,
  }
}

/** 행 부가 항목도 `value` 만이 아니라 라벨까지 — 편집 모드가 `label.trim()` 을 부른다. */
function isIntactExtraField(f: unknown): boolean {
  if (!isPlainObject(f)) return false
  return (
    typeof f.key === 'string' &&
    typeof f.label === 'string' &&
    typeof f.blockType === 'string' &&
    // ⚠️ `RowExtraField.value` 는 **문자열·문자열 배열만**이다(파일 셀은 스키마 밖).
    // `isIntactCell` 로 물으면 파일 셀 객체가 통과해 읽기 렌더러가 객체를 그대로 그리다 죽는다.
    (typeof f.value === 'string' || allStrings(f.value))
  )
}

/** 부가 항목 값은 문자열·문자열 배열로만 — 구조화 셀이 섞여 있으면 글자로 낮춘다. */
function repairExtraValue(x: unknown): string | string[] {
  if (typeof x === 'string') return x
  if (Array.isArray(x)) return asStrings(x)
  if (isPlainObject(x) && x.type === 'file') return asText(x.fileName)
  // ⚠️ 모르는 판별자는 **새 스키마가 쓴 잎**일 수 있다 — 저장 경로에서 낮추면 열었다 저장하는
  // 것만으로 사라진다. 그리기 위한 낮춤은 저장되지 않는 렌더 관문이 맡는다.
  if (isOpaqueCell(x)) return x as unknown as string
  return ''
}

/** 행에 붙는 스키마 밖 부가 값(FRT-76 링크·FRT-178 역할태그·FRT-145 행 항목)까지 본다. */
function isIntactRow(r: Record<string, unknown>): boolean {
  if (!isFilledText(r.id) || !isPlainObject(r.cells)) return false
  if (!Object.values(r.cells).every(c => isIntactCell(c) || isOpaqueCell(c))) return false
  if (r.linkedProjectRowId !== undefined && typeof r.linkedProjectRowId !== 'string') return false
  if (r.id !== undefined && typeof r.id !== 'string') return false
  if (r.roleTags !== undefined && !allStrings(r.roleTags)) return false
  if (r.extraFields !== undefined) {
    if (!Array.isArray(r.extraFields)) return false
    if (!r.extraFields.every(isIntactExtraField)) return false
    // 항목 하나씩 성해도 **key 가 겹치면** 수정·삭제가 둘을 함께 잡는다.
    const ks = r.extraFields.map(f => (f as Record<string, unknown>).key)
    if (new Set(ks).size !== ks.length) return false
  }
  // 행 결과물(FRT-291)도 `id` 를 수정·삭제 핸들러의 이름표로 쓴다 — 위 두 컬렉션과 같은 질문을
  // 여기서도 물어야 한다. 안 물으면 깨진 첨부를 든 행이 '성하다'로 판정돼 `repairRows` 를
  // 통째로 건너뛴 채 렌더에 닿는다.
  if (r.artifacts !== undefined) {
    if (!Array.isArray(r.artifacts)) return false
    if (!r.artifacts.every(isIntactArtifact)) return false
    const as = r.artifacts.map(a => (a as Record<string, unknown>).id)
    if (new Set(as).size !== as.length) return false
  }
  return true
}

function isIntactArtifact(a: unknown): boolean {
  if (!isPlainObject(a)) return false
  if (!isFilledText(a.id)) return false
  if (a.url !== undefined && typeof a.url !== 'string') return false
  if (a.desc !== undefined && typeof a.desc !== 'string') return false
  // 첨부 파일은 셀 파일과 **같은 모양**이라 같은 술어로 묻는다 — 여기서 기준이 갈리면
  // `artifactFilled`(fileId 로 판정)와 어긋나 "찼는데 못 그리는" 첨부가 생긴다.
  if (a.file !== undefined && !isIntactCell(a.file)) return false
  return true
}

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x)

/**
 * 이 값이 자기 `type` 이 약속한 필드를 모두 갖췄는가.
 *
 * 갖췄으면 **원본을 그대로 쓴다** — 정상 값까지 새 객체로 만들면 렌더 관문(BlockRenderer)이
 * 매 렌더 새 props 를 만들어 불필요한 리렌더를 낳는다.
 */
function isIntactBlockValue(v: Record<string, unknown>): boolean {
  switch (v.type) {
    case 'text':
    case 'textarea':
      return typeof v.text === 'string'
    case 'date':
      return typeof v.date === 'string'
    case 'period':
      return (
        typeof v.start === 'string' && typeof v.end === 'string' && typeof v.isCurrent === 'boolean'
      )
    case 'single-select':
      return allStrings(v.options) && typeof v.selected === 'string'
    case 'checklist':
      return allStrings(v.options) && allStrings(v.checked)
    case 'tags':
      return allStrings(v.tags)
    case 'link':
      return (
        typeof v.url === 'string' &&
        typeof v.title === 'string' &&
        typeof v.description === 'string' &&
        typeof v.linkType === 'string'
      )
    case 'file':
      return (
        typeof v.fileName === 'string' &&
        typeof v.description === 'string' &&
        typeof v.evidenceType === 'string' &&
        // 선택 메타데이터도 봐야 한다 — `FileBlock` 이 `mimeType` 에 `.startsWith` 를 부른다.
        isOptText(v.fileId) &&
        isOptText(v.mimeType) &&
        isOptText(v.url) &&
        isOptNumber(v.size)
      )
    case 'repeatable-cell':
      return (
        Array.isArray(v.columns) &&
        v.columns.every(isIntactColumn) &&
        // 열 하나씩 성해도 **key 가 겹치면** 둘이 같은 셀을 가리키고, 하나를 지우면 둘 다 사라진다.
        new Set(v.columns.map(c => (c as Record<string, unknown>).key)).size === v.columns.length &&
        Array.isArray(v.rows) &&
        // 행 `id` 까지 물어야 한다 — 없으면 `repairRows` 를 건너뛴 채 렌더에 닿아
        // React key 가 겹치고 수정·삭제 핸들러가 엉뚱한 행을 잡는다.
        v.rows.every(r => isPlainObject(r) && isIntactRow(r)) &&
        // 행 하나씩은 성해도 **쌍으로 깨질 수 있다** — 같은 id 두 개면 한쪽을 고칠 때 둘 다 바뀐다.
        new Set(v.rows.map(r => (r as Record<string, unknown>).id)).size === v.rows.length
      )
    case 'table':
      return allStrings(v.columns) && Array.isArray(v.rows) && v.rows.every(allStrings)
    case 'group':
      return true
    default:
      return false
  }
}

/**
 * 반복 입력 행 보정. **행을 재구성하지 않고 결측 키만 채운다** — 행에는 스키마 밖 부가 필드가
 * 붙어 있고(`linkedProjectRowId` FRT-76 · `roleTags` FRT-178 · `extraFields` FRT-145),
 * `{id, cells}` 만 다시 만들면 그것들이 조용히 사라진다.
 *
 * `id` 가 없으면 인덱스로 채운다 — `uid()` 를 쓰면 렌더마다 id 가 바뀌어 행이 리마운트되고
 * 입력 포커스가 날아간다(이 함수는 렌더 관문에서도 돈다).
 */
function repairRows(x: unknown, columnRenames?: Map<string, string>): BlockRow[] {
  if (!Array.isArray(x)) return []
  const rows = x.filter(isPlainObject)
  // ⚠️ 이미 쓰이는 id 를 피한다. 겹치면 수정·삭제 핸들러가 행을 id 로 찾으므로 **하나를 고치면
  // 둘 다 바뀌고 하나를 지우면 둘 다 사라진다**(React key 도 중복된다). 인덱스에서 파생시키되
  // 충돌하면 뒤에 번호를 붙인다 — 같은 입력이면 늘 같은 id 라야 렌더마다 행이 리마운트되지 않는다.
  // ⚠️ 저장분에 **이미 중복된 id** 가 있을 수 있다 — 행 하나씩 보면 둘 다 성해 보이지만
  // 쌍으로는 깨져 있다. 앞엣것을 두고 뒤엣것을 갈아 준다(앞뒤가 뒤집히면 안 되므로 순서대로).
  const ids = dedupeNames(rows.map(r => asIdText(r.id)), i => `row-${i}`)
  return rows.map((r, i) => {
    const id = ids[i]
    const cells: Record<string, CellValue> = {}
    if (isPlainObject(r.cells)) {
      for (const [k, c] of Object.entries(r.cells)) {
        // 열 key 가 갈렸으면 셀도 새 이름으로 옮긴다. 새 이름에 이미 값이 있으면 그쪽을 존중한다.
        const renamed = columnRenames?.get(k)
        const key = renamed !== undefined && !(renamed in r.cells) ? renamed : k
        cells[key] = repairCell(c)
      }
    }
    return {
      ...r,
      id,
      cells,
      // 스키마 밖 부가 값도 잎까지 맞춘다 — `rowHasContent` 가 `f.value` 를 직접 읽는다.
      // 링크도 id 와 **같은 방식**으로 살린다 — 한쪽만 글자로 바꾸면 그 링크가 끊긴다.
      // ⚠️ 링크는 **다른 블록**에서 해석된다(`getProjectRow` 는 `targetSectionId` 의 블록에서
      // 찾는다) — 그래서 이 블록의 행 표로 참조를 개명하면 엉뚱한 데를 가리킨다. 여기서 할 일은
      // 양쪽이 **같은 규칙으로** 글자가 되게 하는 것뿐이다.
      ...(r.linkedProjectRowId !== undefined
        ? { linkedProjectRowId: asIdText(r.linkedProjectRowId) || undefined }
        : {}),
      ...(r.roleTags !== undefined ? { roleTags: asStrings(r.roleTags) } : {}),
      ...(r.extraFields !== undefined
        ? {
            // 부가 항목 `key` 도 수정·삭제 핸들러가 쓰는 이름표다 — 겹치면 둘이 함께 바뀐다.
            extraFields: (() => {
              const fs = (Array.isArray(r.extraFields) ? r.extraFields : []).filter(isPlainObject)
              const fKeys = dedupeNames(fs.map(f => asText(f.key)), j => `extra-${j}`)
              return fs.map((f, j) => ({
                ...f,
                key: fKeys[j],
                label: asText(f.label),
                blockType: typeof f.blockType === 'string' ? f.blockType : 'text',
                value: repairExtraValue(f.value),
              }))
            })(),
          }
        : {}),
      // 결과물 첨부(FRT-291)도 `id` 로 수정·삭제된다 — 행 id·부가 항목 key 와 **같은 규칙**으로
      // 겹침을 풀고 잎을 낮춘다. `url`·`desc` 는 없으면 없는 대로 둔다(빈 문자열을 새로 만들면
      // `artifactFilled` 가 보는 "비었음"의 모양이 바뀐다).
      ...(r.artifacts !== undefined
        ? {
            artifacts: (() => {
              const as = (Array.isArray(r.artifacts) ? r.artifacts : []).filter(isPlainObject)
              const aIds = dedupeNames(as.map(a => asIdText(a.id)), j => `art-${j}`)
              return as.map((a, j) => ({
                ...a,
                id: aIds[j],
                ...(a.url !== undefined ? { url: asText(a.url) } : {}),
                ...(a.desc !== undefined ? { desc: asText(a.desc) } : {}),
                ...(a.file !== undefined ? { file: repairCell(a.file) } : {}),
              }))
            })(),
          }
        : {}),
    }
  }) as BlockRow[]
}

/**
 * 저장된 값이 타입이 약속한 모양이 아닐 때 **화면이 죽지 않을 모양으로 되돌린다** (FRT-200).
 *
 * 두 가지 원칙이 있다.
 *
 * 1. **통째로 갈아치우지 않는다.** `{type:'period', start:'2023.01', end:null}` 을 빈 값으로
 *    바꾸면 살아 있는 `start` 가 사라진다. `type` 신호가 살아 있으면 **결측 필드만** 채운다.
 * 2. **`type` 신호가 없으면 복구할 근거도 없다.** 그때만 블록이 선언한 `fallbackType` 의
 *    빈 값으로 되돌린다.
 *
 * 정상 값은 원본 참조를 그대로 돌려준다(위 `isIntactBlockValue` 참고).
 */
export function normalizeBlockValue(
  fallbackType: BlockType,
  value: unknown,
  opts?: { options?: string[]; columns?: BlockColumnDef[] },
): BlockValue {
  // ⚠️ 되살릴 목록도 저장분(`block.options`·`e.options`)이라 **여기서 한 번** 위생을 거친다.
  // 폴백 값을 만드는 `emptyValue` 에 원본을 그대로 넘기면 깨진 원소가 값 안에 그대로 실린다.
  const safeOpts = opts && {
    ...opts,
    ...(opts.options !== undefined ? { options: asStrings(opts.options) } : {}),
  }

  const empty = (): BlockValue => {
    if (fallbackType === 'group') return { type: 'group' }
    // 런타임 값은 타입 선언을 지킬 의무가 없다 — 모르는 타입이면 `emptyValue` 는 undefined 를 준다.
    if (!isKnownBlockType(fallbackType)) return { type: 'text', text: '' }
    return emptyValue(fallbackType, safeOpts)
  }

  /**
   * 선택지는 사용자가 고른 값이 아니라 **블록이 소유한 목록**이다. 결측이면 블록이 아는
   * 목록으로 되살린다 — `ChecklistBlock` 은 `val.options` 를 그대로 그리므로(형제
   * `SingleSelectBlock` 과 달리 `block.options` 폴백이 없다) 빈 목록으로 두면 체크박스가
   * 하나도 없는 칸이 되어 **이미 고른 값을 끌 수조차 없다**.
   *
   * ⚠️ **배열이면 빈 배열이어도 그대로 존중한다.** 사용자가 선택지를 전부 지운 상태가
   * 정당하게 `[]` 로 저장되는데(ChecklistBlock 의 `removeOption`), 그걸 되살리면 지운 항목이
   * 부활한다 — 값 유실보다 나쁜 게 무음 오염이다. 되살리는 건 키가 아예 깨진 경우뿐이다.
   */
  // ⚠️ 되살릴 목록도 저장분에서 온다(`e.options`·`block.options`) — 그것 역시 깨져 있을 수
  // 있으므로 값 배열과 **같은 위생**을 거쳐야 한다. 안 그러면 `ChecklistBlock` 이 객체를 그린다.
  const optionsOf = (raw: unknown): string[] =>
    Array.isArray(raw) ? asStrings(raw) : asStrings(opts?.options)

  if (!isPlainObject(value)) return empty()

  /**
   * 값이 든 `type` 이 깨졌거나 이 코드가 모르는 것이면 **블록이 선언한 타입**을 신호로 쓴다.
   *
   * ⚠️ 여기서 통째로 비우면 안 된다. `{start:'2023.01', end:'2023.12'}` 처럼 `type` 하나만 빠진
   * 값에도 살릴 알맹이가 그대로 들어 있고, 애초에 그 값을 그리던 컨트롤도 `block.type` 으로
   * 골라져 있었다. 비우면 **열었다 저장하는 것만으로 사용자 입력이 영구히 지워진다.**
   */
  // ⚠️ **모르는 판별자는 "깨진 것"이 아니라 "내가 모르는 것"일 수 있다** — 새 스키마가 쓴 값을
  // 구 프론트가 여는 경우다. 블록 타입으로 갈아 끼우면 그 판별자가 지워진 채 저장되어,
  // 열었다 저장하는 것만으로 새 스키마 값이 구 모양으로 굳는다. 그러니 **그대로 둔다.**
  // 그리려면 모양이 필요하지만, 그건 저장되지 않는 렌더 관문(`normalizeBlockForRender`)의 몫이다.
  if (isOpaqueType(value.type)) {
    return value as unknown as BlockValue
  }

  // 판별자가 없거나·문자열이 아니거나·비어 있으면 신호가 깨진 것이다 — 그때만 블록이 선언한 타입으로 살린다.
  const effective = isKnownBlockType(value.type)
    ? value.type
    : isKnownBlockType(fallbackType)
      ? fallbackType
      : undefined

  // 값도 블록도 모르는 타입이면 복구할 근거가 없다 — 그래도 **지우지는 않는다**.
  if (!effective) return value as unknown as BlockValue

  if (effective === value.type && isIntactBlockValue(value)) return value as unknown as BlockValue

  const v = effective === value.type ? value : { ...value, type: effective }
  switch (effective) {
    case 'text':
    case 'textarea':
      return { ...v, type: v.type, text: asText(v.text) } as BlockValue
    case 'date':
      return { ...v, type: 'date', date: asText(v.date) } as BlockValue
    case 'period':
      return {
        ...v,
        type: 'period',
        start: asText(v.start),
        end: asText(v.end),
        isCurrent: v.isCurrent === true,
      } as BlockValue
    case 'single-select':
      return {
        ...v,
        type: 'single-select',
        options: optionsOf(v.options),
        selected: asText(v.selected),
      } as BlockValue
    case 'checklist':
      return {
        ...v,
        type: 'checklist',
        options: optionsOf(v.options),
        checked: asStrings(v.checked),
      } as BlockValue
    case 'tags':
      return { ...v, type: 'tags', tags: asStrings(v.tags) } as BlockValue
    case 'link':
      return {
        ...v,
        type: 'link',
        url: asText(v.url),
        title: asText(v.title),
        description: asText(v.description),
        linkType: asText(v.linkType),
      } as BlockValue
    case 'file':
      return {
        ...v,
        type: 'file',
        fileName: asText(v.fileName),
        description: asText(v.description),
        evidenceType: asText(v.evidenceType),
        // 선택 메타데이터는 `...v` 로 흘러들어오면 깨진 채 렌더에 닿는다(`mimeType.startsWith`).
        fileId: optText(v.fileId),
        mimeType: optText(v.mimeType),
        url: optText(v.url),
        size: typeof v.size === 'number' ? v.size : undefined,
      } as BlockValue
    case 'repeatable-cell':
      return {
        ...v,
        type: 'repeatable-cell',
        // 열 정의도 사용자가 친 값이 아니라 **템플릿이 주는 정의**다 — `options` 와 같은 근거로
        // 결측이면 되살린다. 열이 비면 표는 그릴 칸조차 없다. 배열이면 빈 배열도 존중한다.
        // 열은 `key` 로 셀을 찾으므로 자리에 뜻이 없다 — 객체가 아닌 열은 걸러 내고(표와 다른 점),
        // 나머지는 필드 단위로 맞춘 뒤 겹친 key 를 결정적으로 갈아 준다.
        // key 가 바뀌면 **그 열이 쓰던 셀도 같이 옮긴다** — 이름표만 갈면 값은 옛 이름 아래
        // 남고 렌더러는 새 이름으로 찾아, 저장된 값이 화면에서 사라진다.
        ...(Array.isArray(v.columns)
          ? (({ columns, renames }) => ({
              columns,
              rows: repairRows(v.rows, renames),
            }))(repairColumns(v.columns, allCellKeys(v.rows)))
          : {
              columns: Array.isArray(opts?.columns) ? opts.columns : [],
              rows: repairRows(v.rows),
            }),
      } as BlockValue
    case 'table':
      return {
        ...v,
        type: 'table',
        columns: asStringsInPlace(v.columns),
        rows: Array.isArray(v.rows) ? v.rows.map(asStringsInPlace) : [],
      } as BlockValue
    case 'group':
      return { type: 'group' }
    default:
      // 이 코드가 모르는 type — 복구할 근거가 없으니 블록이 선언한 타입으로 되돌린다.
      return empty()
  }
}

/**
 * 조건부 노출 조건을 살린다.
 *
 * ⚠️ **살릴 게 없는 연산자는 빈 배열로 두지 말고 뺀다.** `isConditionMet` 은 `equals` 가
 * 있으면 그걸로만 판정하므로 `[]` 는 "조건 없음"이 아니라 **"아무것도 안 맞음"**이 되어
 * 그 필드가 영원히 숨는다 — 값이 있어도 화면에서 사라진다.
 */
function repairCondition(cond: Record<string, unknown> | undefined): Block['visibleWhen'] {
  if (!isPlainObject(cond) || typeof cond.key !== 'string' || !isFilledText(cond.key)) {
    return undefined
  }
  const equals = cond.equals !== undefined ? asStrings(cond.equals) : undefined
  const startsWith = cond.startsWith !== undefined ? asStrings(cond.startsWith) : undefined
  return {
    key: cond.key,
    ...(equals?.length ? { equals } : {}),
    ...(startsWith?.length ? { startsWith } : {}),
  }
}

/** 블록 하나의 값을 보정한다. 값이 온전하면 **원본 블록 참조를 그대로** 돌려준다. */
export function normalizeBlock(block: Block, defs?: BlockDefs): Block {
  // ⚠️ 블록 타입이 깨졌는데 **값이 신원을 알려 주면** 그걸로 되살린다 — 안 그러면 렌더러가
  // `block.type` 으로 분기해 아무것도 안 그리고, 저장은 깨진 타입을 계속 실어 나른다.
  // 모르는 *이름*의 타입은 새 스키마의 흔적이라 그대로 둔다(위 보존 규칙과 같은 경계).
  // ⚠️ **빈 문자열은 "모르는 이름"이 아니라 신호 없음이다** — 여기서 걸러내지 않으면 그 블록은
  // 렌더 switch 의 어느 갈래에도 안 걸려 영원히 아무것도 안 그려진다.
  if (!isFilledText(block.type)) {
    const fromValue = (block.value as { type?: unknown } | null | undefined)?.type
    if (isKnownBlockType(fromValue)) block = { ...block, type: fromValue }
  }
  // 블록이 아는 정의를 함께 넘긴다 — 값에서 사라진 선택지·열을 되살릴 근거다.
  //
  // ⚠️ **결측 정의를 근거 없이 `[]` 로 굳히면 그 뒤로는 못 되살린다.** 보정은 배열이면 빈
  // 배열도 사용자의 선택으로 존중하므로, 나중에 템플릿과 병합하는 경로(v1)에서는 여기서
  // 정의를 함께 넘겨야 "결측"과 "사용자가 다 지움"이 구분된 채로 남는다.
  // ⚠️ **`??` 가 아니라 배열인지로 고른다.** 블록의 정의도 저장 JSONB 라 `{}` 같은 값이 올 수
  // 있는데, `??` 는 그 객체를 "있는 정의"로 골라 폴백을 막는다 — 그러면 선택지가 `[]` 로
  // 굳고, 병합 경로는 그 빈 배열을 **사용자가 다 지운 것**으로 존중해 템플릿 선택지가 영영
  // 안 돌아온다. 체크된 값이 남아 있어도 끌 칸조차 그려지지 않는다.
  let value = normalizeBlockValue(block.type, block.value, {
    options: Array.isArray(block.options) ? block.options : defs?.options,
    columns: defs?.columns,
  })
  // ⚠️ **타입이 어긋나도 저장 경로에서는 값을 비우지 않는다.** 아는 타입끼리 어긋난 값도
  // 복구 가능한 정보이고, 여기서 갈아치우면 열었다 저장하는 것만으로 사라진다(v1 은 이
  // 정규화가 "커스텀으로 보존할지" 결정보다 **먼저** 돈다). 그릴 모양을 만드는 일은 저장되지
  // 않는 렌더 관문(`normalizeBlockForRender`)이 맡고, 거기선 읽기 전용으로 그린다.
  //
  // 예외는 text ↔ textarea 하나뿐이다 — 저장 모양이 같아 무손실이고, 매퍼의 `injectValue`
  // (`textualCompatValue`)가 이미 호환으로 결론 내린 쌍이다.
  const textual = new Set(['text', 'textarea'])
  if (
    isKnownBlockType(block.type) &&
    isKnownBlockType(value.type) &&
    value.type !== block.type &&
    textual.has(block.type) &&
    textual.has(value.type)
  ) {
    value = { ...value, type: block.type } as BlockValue
  }
  // ⚠️ 자식 목록도 저장 JSONB 다 — 배열이 아니면 `.map` 이 그 자리에서 죽고, 원소가 null 이면
  // 재귀가 첫 프로퍼티 접근에서 죽는다. 배열 보정은 `normalizeBlocks` 와 같은 기준으로.
  const children = block.children === undefined ? undefined : normalizeBlocks(
    Array.isArray(block.children) ? block.children : [],
    defs ? () => defs : undefined,
  )
  const childrenChanged = children !== block.children

  // ⚠️ `block.options` 는 값이 아니라 **블록 자신의 필드**인데 역시 저장분에서 온다.
  // `SingleSelectBlock` 과 `FileBlock` 이 이걸 직접 읽으므로(`.map`·`.includes`) 여기서 맞춘다.
  // ⚠️ `null`·`undefined` 는 "빈 목록"이 아니라 **정의가 없다**는 뜻이다. `[]` 로 굳히면
  // 나중 템플릿 복원이 "사용자가 다 지웠다"로 읽어(빈 배열은 truthy) 드롭다운이 사라진다.
  const optionsBroken =
    block.options !== undefined && block.options !== null && !allStrings(block.options)
  const options = optionsBroken ? asStrings(block.options) : block.options

  // ⚠️ 표시 문자열도 저장분에서 온다 — `TextBlock` 등이 `block.label` 을 React 자식으로 **그대로**
  // 그리므로, 객체가 실려 오면 값이 아무리 성해도 그 자리에서 화면이 죽는다.
  // ⚠️ 조건부 노출 메타데이터도 저장분이다 — `isConditionMet` 이 `equals?.includes(...)` 를
  // 부르므로 배열이 아니면 그 자리에서 죽고, 폼은 **렌더 전에** 그 판정을 돈다.
  const cond = block.visibleWhen as Record<string, unknown> | undefined
  const conditionBroken =
    cond !== undefined &&
    (!isPlainObject(cond) ||
      // 빈 키는 "조건 없음"이 아니다 — 맞는 트리거를 못 찾아 그 칸이 영원히 숨는다.
      !isFilledText(cond.key) ||
      // ⚠️ 길이 0 도 깨진 것으로 본다 — 배열이라고 성한 게 아니다. `isConditionMet` 은
      // 연산자가 있으면 그걸로만 판정하므로 `[]` 는 "아무것도 안 맞음"이 되어 필드가 영원히 숨는다.
      (cond.equals !== undefined && (!allStrings(cond.equals) || (cond.equals as unknown[]).length === 0)) ||
      (cond.startsWith !== undefined &&
        (!allStrings(cond.startsWith) || (cond.startsWith as unknown[]).length === 0)))

  const categoryBroken = block.category !== undefined && !isKnownCategory(block.category)

  // ⚠️ `OutcomeList` 는 `linkConfig.label` 을 React 자식으로 **그대로** 그린다 — 객체면 죽는다.
  const link = block.linkConfig as Record<string, unknown> | undefined
  const linkBroken =
    link !== undefined &&
    (!isPlainObject(link) ||
      typeof link.targetSectionId !== 'string' ||
      typeof link.titleColumnKey !== 'string' ||
      !isOptText(link.label))

  // ⚠️ `required` 는 표시가 아니라 **폼 의미**를 바꾼다(진행도·숨김 가능 여부). 객체나
  // `"false"` 같은 truthy 쓰레기가 통과하면 그 칸이 영원히 필수가 된다. 참일 때만 참으로 둔다.
  const BOOL_KEYS = ['required', 'collapsed', 'lockColumns', 'allowRowExtras'] as const
  const boolsBroken = BOOL_KEYS.some(k => {
    const raw = (block as unknown as Record<string, unknown>)[k]
    return raw !== undefined && typeof raw !== 'boolean'
  })
  const repairedBools = boolsBroken
    ? Object.fromEntries(
        BOOL_KEYS.map(k => {
          const raw = (block as unknown as Record<string, unknown>)[k]
          return [k, raw === true ? true : raw === false ? false : undefined]
        }),
      )
    : undefined

  const stringsBroken =
    typeof block.label !== 'string' ||
    !isOptText(block.placeholder) ||
    !isOptText(block.guide) ||
    !isOptText(block.key)

  if (
    value === block.value &&
    !childrenChanged &&
    !optionsBroken &&
    !stringsBroken &&
    !conditionBroken &&
    !categoryBroken &&
    !boolsBroken &&
    !linkBroken
  )
    return block
  return {
    ...block,
    value,
    ...(optionsBroken ? { options } : {}),
    ...(stringsBroken
      ? {
          label: asText(block.label),
          placeholder: optText(block.placeholder),
          guide: optText(block.guide),
          key: optText(block.key),
        }
      : {}),
    ...(children ? { children } : {}),
    // 조건이 깨졌으면 **버린다** — 지어낸 조건으로 필드를 숨기면 값이 화면에서 사라진다.
    ...(conditionBroken ? { visibleWhen: repairCondition(cond) } : {}),
    // 모르는 `category` 는 뺀다 — 그래야 소비처의 기본값(`?? 'detail'`)이 다시 산다.
    ...(categoryBroken ? { category: undefined } : {}),
    ...(repairedBools ?? {}),
    // 설정이 깨졌으면 **버린다** — 지어낸 링크 설정은 없는 대상 섹션을 가리킨다.
    ...(linkBroken
      ? {
          linkConfig:
            isPlainObject(link) &&
            typeof link.targetSectionId === 'string' &&
            typeof link.titleColumnKey === 'string'
              ? {
                  targetSectionId: link.targetSectionId,
                  titleColumnKey: link.titleColumnKey,
                  ...(link.label !== undefined ? { label: asText(link.label) } : {}),
                }
              : undefined,
        }
      : {}),
  }
}

export interface BlockDefs {
  options?: string[]
  columns?: BlockColumnDef[]
}

/**
 * 블록 배열을 보정한다. 전부 온전하면 원본 배열 참조를 그대로 돌려준다.
 *
 * `defsOf` 는 블록별 정의(선택지·열) 출처다 — v1 처럼 저장 블록이 정의를 잃었을 수 있고
 * 현재 템플릿이 그 정의를 아는 경우에 넘긴다.
 */
/**
 * 여러 블록 배열에 **걸쳐** id 를 유일하게 만든다.
 *
 * ⚠️ 배열 안에서만 보면 이미 같은 id 를 든 두 블록이 둘 다 성해 보인다. 폼은 core·extension 을
 * **하나의 id 맵**으로 합쳐 쓰므로(`writeBackBlocks`), 한쪽을 고치면 다른 쪽이 같은 객체로 덮인다.
 */
export function dedupeBlockIdsAcross(groups: Block[][]): Block[][] {
  const flat = groups.flat()
  const ids = dedupeNames(flat.map(b => asIdText(b.id)), i => `blk-${i}`)
  let i = 0
  return groups.map(group =>
    group.map(b => {
      const id = ids[i++]
      return b.id === id ? b : { ...b, id }
    }),
  )
}

/**
 * 이 값 **안쪽**에 이 코드가 모르는 잎이 있는가 — 모르는 열 유형의 불투명 셀 같은 것.
 *
 * ⚠️ 블록 타입이 아는 것이어도 안쪽이 모르는 값이면 편집 칸을 열면 안 된다. 셀 컨트롤이
 * 불투명 객체를 빈 글자로 접어 그리고, 첫 입력이 **보존해 둔 값을 덮는다**.
 */
function hasOpaqueLeaf(value: unknown): boolean {
  if (!isPlainObject(value) || value.type !== 'repeatable-cell') return false
  if (!Array.isArray(value.rows)) return false
  return value.rows.some(r => {
    if (!isPlainObject(r)) return false
    // ⚠️ **열 유형은 묻지 않는다.** 저장 경로가 열과 무관하게 지키므로, 여기서 열을 조건으로
    // 걸면 아는 열 밑의 보존된 값 위에 편집 칸이 열리고 첫 입력이 그 값을 덮는다.
    const cellHit = isPlainObject(r.cells) && Object.values(r.cells).some(isOpaqueCell)
    // 행 부가 항목도 센다 — 읽기 렌더러가 `f.value` 를 그대로 그리므로 더 위험하다.
    const extraHit =
      Array.isArray(r.extraFields) &&
      r.extraFields.some(f => isPlainObject(f) && isOpaqueCell(f.value))
    return cellHit || extraHit
  })
}

/**
 * **표시 전용** 보정 — 렌더 관문(`BlockRenderer`)만 쓴다.
 *
 * 저장 경로(`normalizeBlock`)는 모르는 판별자를 그대로 지킨다. 하지만 그리려면 컨트롤이 읽을
 * 모양이 있어야 하므로, 여기서만 블록이 선언한 타입의 빈 값으로 바꿔 준다.
 * **이 결과는 저장되지 않는다** — 그래서 새 스키마 값을 구 모양으로 굳히지 않는다.
 */
/**
 * **표시 전용** — 행 안쪽의 불투명 값(새 스키마의 잎)을 그릴 수 있는 글자로 낮춘다.
 *
 * ⚠️ 셀 컨트롤과 읽기 렌더러가 셀·부가 값을 React 자식으로 **그대로** 그리므로 객체가 닿으면
 * 죽는다. 저장 경로는 그 값을 지키고(`repairCell`·`repairExtraValue`), 낮추는 건 여기서만 한다
 * — 이 결과는 저장되지 않고, 그 블록은 `isUnrenderableBlock` 이 읽기 전용으로 잠근다.
 */
function lowerOpaqueLeaves(block: Block): Block {
  const v = block.value as unknown as Record<string, unknown> | null | undefined
  if (!isPlainObject(v) || v.type !== 'repeatable-cell' || !Array.isArray(v.rows)) return block
  let changed = false
  const rows = v.rows.map(r => {
    if (!isPlainObject(r)) return r
    const cellHit = isPlainObject(r.cells) && Object.values(r.cells).some(isOpaqueCell)
    const extraHit =
      Array.isArray(r.extraFields) && r.extraFields.some(f => isPlainObject(f) && isOpaqueCell(f.value))
    if (!cellHit && !extraHit) return r
    changed = true
    return {
      ...r,
      ...(cellHit
        ? {
            cells: Object.fromEntries(
              Object.entries(r.cells as Record<string, unknown>).map(([k, c]) => [
                k,
                isOpaqueCell(c) ? '' : c,
              ]),
            ),
          }
        : {}),
      ...(extraHit
        ? {
            extraFields: (r.extraFields as unknown[]).map(f =>
              isPlainObject(f) && isOpaqueCell(f.value) ? { ...f, value: '' } : f,
            ),
          }
        : {}),
    }
  })
  return changed ? ({ ...block, value: { ...v, rows } } as unknown as Block) : block
}

/**
 * 이 값 위에 **편집 경로를 열면 안 되는가.**
 *
 * ⚠️ 입력 칸(`BlockRenderer`)과 그 바깥의 연필(`BlockList`)이 **같은 술어로 물어야 한다.**
 * 한쪽만 잠그면 다른 쪽이 열린 채 남고, 그 통로로 들어간 첫 입력이 보존해 둔 값을 덮는다.
 * 실제로 입력 칸만 잠갔더니 연필은 살아 있었고, 눌리면 `getEditConfig` 가 불투명 값을
 * 모달에 그대로 넘겨 `.join()` 에서 화면이 통째로 죽었다.
 */
export function isUnrenderableBlock(block: Block): boolean {
  const t = (block.value as { type?: unknown } | null | undefined)?.type
  // 이름이 있는 미지 판별자이거나, 아는 것끼리 어긋난 값 — 이 컨트롤이 다룰 수 있는 값이 아니다.
  // (빈 판별자는 여기 안 걸린다 — `normalizeBlock` 이 블록 타입으로 되살리므로 편집 가능하다.)
  if (isOpaqueType(t) || (isFilledText(t) && t !== block.type)) return true
  // 블록 타입은 아는 것이어도 **안쪽에 모르는 잎**이 있을 수 있다.
  return hasOpaqueLeaf(block.value)
}

export function normalizeBlockForRender(block: Block): Block {
  const normalized = lowerOpaqueLeaves(normalizeBlock(block))
  const v = normalized.value as BlockValue | null | undefined
  if (!isKnownBlockType(block.type) || (v && v.type === block.type)) return normalized
  return { ...normalized, value: normalizeBlockValue(block.type, undefined, { options: block.options }) }
}

export function normalizeBlocks(
  blocks: Block[],
  defsOf?: (block: Block) => BlockDefs | undefined,
  /** 폴백 id 의 이름공간. **배열마다 따로 보정하면 각 배열의 첫 블록이 같은 id 를 받는다** —
   * 폼은 core·extension 을 한 id 맵으로 합쳐 쓰므로 한쪽을 고치면 다른 쪽이 바뀐다. */
  idScope = 'blk',
): Block[] {
  if (!Array.isArray(blocks)) return []
  const kept = blocks.filter(b => !!b && typeof b === 'object')
  // ⚠️ 블록 `id` 도 이름표다 — `BlockList` 의 수정·삭제가 id 로 블록을 찾으므로 겹치면 둘이
  // 함께 바뀌고 함께 지워진다(React key·드래그 식별자도 모호해진다). 행·열과 같은 규칙으로 간다.
  const ids = dedupeNames(kept.map(b => asIdText(b.id)), i => `${idScope}-${i}`)
  const out = kept.map((b, i) => {
    const normalized = normalizeBlock(b, defsOf?.(b))
    return normalized.id === ids[i] ? normalized : { ...normalized, id: ids[i] }
  })
  return out.length === blocks.length && out.every((b, i) => b === blocks[i]) ? blocks : out
}

/**
 * `isBlockEmpty` 가 안 세는 부속 값이 남아 있는지.
 *
 * `isBlockEmpty` 는 링크를 `url`, 파일을 업로드 신원(`fileName`/`fileId`/`url`)으로만 판정한다 —
 * "상세뷰에 그릴 게 있는가"를 묻는 기준이라 그 자체로는 옳다. 그런데 두 블록 모두 **주 값 없이
 * 부속 값을 먼저 칠 수 있고**(LinkBlock 의 제목·유형·설명, FileBlock 의 설명·증빙 유형),
 * `FileBlock` 은 파일을 지워도 설명·증빙 유형을 **의도적으로 남긴다**(handleDelete).
 */
export function hasResidualValue(block: Block): boolean {
  const v = block.value
  if (v.type === 'link') return [v.title, v.description, v.linkType].some(isFilledText)
  if (v.type === 'file') return [v.description, v.evidenceType].some(isFilledText)
  return false
}

/**
 * **"버려도 되는 블록인가"** — 로드·이관 과정에서 블록을 통째로 떨어뜨릴지 묻는 자리 전용.
 *
 * `isBlockEmpty` 하나로 물으면 안 된다. 그건 "그릴 게 있는가"이지 "사용자가 친 게 있는가"가
 * 아니다 — 파일 없이 설명·증빙 유형만 적어 둔 증빙 블록은 `isBlockEmpty` 로 **비어 있고**,
 * 그 판정으로 버리면 사용자가 입력한 메타데이터가 다음 저장에 영구 삭제된다(FRT-267 Codex P2).
 *
 * ⚠️ **"목적지가 찼는가"에는 쓰지 말 것.** 그건 다른 질문이다 — 설명만 있는 목적지를 '찼다'로
 * 보면 실제 파일을 든 이관이 막힌다(`applyScopedMigrations` 는 계속 `isBlockEmpty` 를 쓴다).
 */
/**
 * 이 값이 그 자리를 **차지하고 있는가** — 이관·개명이 덮어써도 되는지 묻는 술어.
 *
 * ⚠️ `!isBlockEmpty(...)` 로 물으면 안 된다. 모르는 판별자는 "그릴 게 없다"(=empty)지만
 * **덮어쓰면 새 스키마가 쓴 값이 영구히 사라진다.** 여기서도 "그리기"와 "덮어쓰기"는 다른 질문이다.
 */
export function isValueOccupied(value: BlockValue | null | undefined): boolean {
  if (!value || typeof value !== 'object') return false
  // 모르는 판별자는 지킨다(새 스키마가 쓴 값).
  if (typeof value.type === 'string' && !isKnownBlockType(value.type)) return true
  // ⚠️ `isBlockDiscardable` 을 쓰면 **부속 값만 남은 목적지**(파일 없이 설명만 적힌 증빙)가
  // "차지됨"이 된다. 개명은 원본을 먼저 지우므로 그러면 실제 첨부가 옮겨지지도 보존되지도
  // 않고 사라진다 — 여기서 묻는 것은 "그릴 내용이 있는가"다.
  // ⚠️ **정규화와 같은 눈으로 봐야 한다.** 원소가 전부 깨진 배열은 길이만 보면 채워진 것
  // 같지만 정규화하면 빈 배열이 된다 — 그 사이에 레거시 원본은 이미 지워진다.
  const safe = normalizeBlockValue(value.type, value)
  return !isBlockEmpty({ id: '', type: safe.type, label: '', value: safe })
}

export function isBlockDiscardable(block: Block): boolean {
  const v = block.value as BlockValue | null | undefined
  // ⚠️ **"그릴 게 없다"와 "버려도 된다"는 다른 질문이다.** 이 코드가 모르는 type(새 스키마가 쓴
  // 값·구 프론트가 배포된 상태)은 `isBlockEmpty` 에선 비어 있지만, 버리면 저장 왕복에서 그 키가
  // 통째로 사라진다 — 못 그린다는 이유로 남의 데이터를 지우는 셈이다.
  if (v && typeof v.type === 'string' && !isKnownBlockType(v.type)) return false
  // 값에 판별자가 없어도 **블록 타입 자체가 미지**면 그건 새 스키마의 흔적이다 — 버리면 지운다.
  // ⚠️ **"모르는 문자열"과 "아예 없음"은 다르다.** 앞은 새 스키마의 흔적이라 지켜야 하지만,
  // 뒤는 그냥 손상이라 이관·개명이 덮어쓸 수 있어야 한다 — 목적지를 "차지됨"으로 오판하면
  // 레거시 원본이 지워진 채 아무것도 안 남는다.
  if (typeof block.type === 'string' && !isKnownBlockType(block.type) && v && typeof v === 'object')
    return false
  // 그룹은 **자식이 곧 내용**이다. 자식 하나가 못 버릴 값이면 섹션째 버려선 안 된다 —
  // 완료 저장의 빈 섹션 정리가 이 판정을 쓰므로, 여기서 참이면 그 값이 영구히 사라진다.
  if (block.type === 'group' || v?.type === 'group') {
    return (block.children ?? []).every(c => isBlockDiscardable(c))
  }
  return isBlockEmpty(block) && !hasResidualValue(block)
}

/**
 * 블록이 "필수"인지 — `block.required` 뿐 아니라 **필수 컬럼을 가진 표**도 필수로 본다.
 * 표의 필수는 블록이 아니라 컬럼에 붙는 경우가 많고(18유형 중 13개), 블록 층위만 보면
 * 진행도 바는 필수로 세는데 숨김 UI 는 선택으로 보는 식으로 기준이 갈린다.
 * 진행도(`isCardComplete`)와 숨김(`canHideBlock`)이 이 판정을 공유한다.
 */
export function isRequiredBlock(block: Block): boolean {
  if (block.required) return true
  if (block.value.type === 'repeatable-cell') {
    return block.value.columns.some(c => c.required)
  }
  return false
}

export function validateRequiredBlocks(blocks: Block[]): string[] {
  const errors: string[] = []
  for (const block of blocks) {
    if (block.type === 'group') {
      // Groups have no required flag; validate only their children
      errors.push(...validateRequiredBlocks(block.children ?? []))
      continue
    }
    if (block.required && isBlockEmpty(block)) {
      errors.push(`"${block.label}" 항목을 입력해주세요.`)
    }
  }
  return errors
}
