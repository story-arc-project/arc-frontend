import type {
  Block,
  BlockType,
  BlockValue,
  BlockRow,
  BlockColumnDef,
  CellValue,
  FileCellValue,
  ProjectLinkConfig,
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
      return { type: 'repeatable-cell', columns: opts?.columns ?? [], rows: [] }
    case 'table':
      return { type: 'table', columns: [], rows: [] }
  }
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
  opts?: { collapsed?: boolean; lockColumns?: boolean; guide?: string; allowRowExtras?: boolean },
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
  if (isFileCellValue(cell)) return cell.fileId.trim() !== ''
  return Array.isArray(cell) ? cell.length > 0 : cell.trim() !== ""
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
    // 기준(fileId)으로 판정해 두 함수가 어긋나지 않게 한다.
    if (!cell.fileId.trim()) return ""
    // 파일명이 비면 첨부했다는 사실 자체가 화면에서 사라진다 — 대체 문구로 흔적을 남긴다.
    return cell.fileName.trim() || "첨부파일"
  }
  return Array.isArray(cell) ? cell.join(", ") : cell
}

/**
 * 반복 입력 행 하나에 사용자가 남긴 내용이 있는지. 셀뿐 아니라 그 행에만 붙은 항목
 * (`extraFields`, FRT-145)까지 본다 — 셀만 보면 추가 항목에만 값을 쓴 행이 '빈 행'으로
 * 판정돼 상세뷰에서 통째로 사라진다(유령 행 필터가 사용자 값을 숨기는 형태).
 * 빈 판정을 하는 세 곳(isBlockEmpty · RepeatableCellBlock readOnly · 진행도)이 이 함수를 공유한다.
 */
export function rowHasContent(row: BlockRow): boolean {
  // 저장된 행에 `cells` 가 아예 없을 수 있다(FRT-200) — `Object.values(undefined)` 는 던진다.
  if (!row || typeof row !== 'object') return false
  const cells = row.cells && typeof row.cells === 'object' ? row.cells : {}
  return (
    Object.values(cells).some(cellFilled) ||
    (row.extraFields ?? []).some(f => cellFilled(f.value))
  )
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
      // 이 코드가 모르는 type(구 스키마 잔재·손상 값)은 그릴 것이 없다고 본다.
      return true
  }
}

/**
 * ⚠️ **저장된 값은 타입이 약속한 모양대로 오지 않는다.** `injectValue`(experience-mapper) 는
 * `content.fields[key]` 를 `{...block, value}` 로 통째로 싣는데 `content` 는 서버 JSONB 라,
 * 부속 필드가 빠진 채 저장된 구 레코드가 그대로 블록 값이 된다. 이 판정은 모든 블록에 대해
 * 돌므로 여기서 `undefined.trim()` 이 나면 화면이 통째로 터진다.
 */
function isFilledText(s: unknown): boolean {
  return typeof s === 'string' && s.trim() !== ''
}

// ─── 손상된 저장 값 보정 (FRT-200) ───────────────────────────────

const asText = (x: unknown): string => (typeof x === 'string' ? x : '')

const asStrings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []

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
      return Array.isArray(v.options) && typeof v.selected === 'string'
    case 'checklist':
      return Array.isArray(v.options) && Array.isArray(v.checked)
    case 'tags':
      return Array.isArray(v.tags)
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
        typeof v.evidenceType === 'string'
      )
    case 'repeatable-cell':
      return (
        Array.isArray(v.columns) &&
        Array.isArray(v.rows) &&
        v.rows.every(r => isPlainObject(r) && isPlainObject(r.cells))
      )
    case 'table':
      return Array.isArray(v.columns) && Array.isArray(v.rows) && v.rows.every(r => Array.isArray(r))
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
function repairRows(x: unknown): BlockRow[] {
  if (!Array.isArray(x)) return []
  return x.filter(isPlainObject).map((r, i) => ({
    ...r,
    id: asText(r.id) || `row-${i}`,
    cells: isPlainObject(r.cells) ? (r.cells as Record<string, CellValue>) : {},
  })) as BlockRow[]
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
export function normalizeBlockValue(fallbackType: BlockType, value: unknown): BlockValue {
  const empty = (): BlockValue =>
    fallbackType === 'group' ? { type: 'group' } : emptyValue(fallbackType)

  if (!isPlainObject(value) || typeof value.type !== 'string') return empty()
  if (isIntactBlockValue(value)) return value as unknown as BlockValue

  const v = value
  switch (v.type) {
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
        options: asStrings(v.options),
        selected: asText(v.selected),
      } as BlockValue
    case 'checklist':
      return {
        ...v,
        type: 'checklist',
        options: asStrings(v.options),
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
      } as BlockValue
    case 'repeatable-cell':
      return {
        ...v,
        type: 'repeatable-cell',
        columns: Array.isArray(v.columns) ? (v.columns as BlockColumnDef[]) : [],
        rows: repairRows(v.rows),
      } as BlockValue
    case 'table':
      return {
        ...v,
        type: 'table',
        columns: asStrings(v.columns),
        rows: Array.isArray(v.rows) ? v.rows.map(asStrings) : [],
      } as BlockValue
    case 'group':
      return { type: 'group' }
    default:
      // 이 코드가 모르는 type — 복구할 근거가 없으니 블록이 선언한 타입으로 되돌린다.
      return empty()
  }
}

/** 블록 하나의 값을 보정한다. 값이 온전하면 **원본 블록 참조를 그대로** 돌려준다. */
export function normalizeBlock(block: Block): Block {
  const value = normalizeBlockValue(block.type, block.value)
  const children = block.children?.map(normalizeBlock)
  const childrenChanged =
    !!block.children && children!.some((c, i) => c !== block.children![i])
  if (value === block.value && !childrenChanged) return block
  return { ...block, value, ...(children ? { children } : {}) }
}

/** 블록 배열을 보정한다. 전부 온전하면 원본 배열 참조를 그대로 돌려준다. */
export function normalizeBlocks(blocks: Block[]): Block[] {
  if (!Array.isArray(blocks)) return []
  const out = blocks.filter(b => !!b && typeof b === 'object').map(normalizeBlock)
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
export function isBlockDiscardable(block: Block): boolean {
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
