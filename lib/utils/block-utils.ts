import type {
  Block,
  BlockType,
  BlockValue,
  BlockRow,
  BlockColumnDef,
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

export function createDateField(label: string, opts?: { required?: boolean }): Block {
  return createBlock('date', label, opts)
}

export function createPeriodField(label: string, opts?: { required?: boolean }): Block {
  return createBlock('period', label, opts)
}

export function createSelectField(label: string, options: string[], opts?: { required?: boolean }): Block {
  return createBlock('single-select', label, { ...opts, options })
}

export function createChecklistField(label: string, options: string[], opts?: { required?: boolean }): Block {
  return createBlock('checklist', label, { ...opts, options })
}

export function createTagsField(label: string, opts?: { required?: boolean; guide?: string }): Block {
  return createBlock('tags', label, opts)
}

export function createLinkField(label: string, opts?: { required?: boolean; placeholder?: string; guide?: string }): Block {
  return createBlock('link', label, opts)
}

export function createFileField(label: string, opts?: { required?: boolean }): Block {
  return createBlock('file', label, opts)
}

/**
 * 템플릿 정의용 표형 반복 입력. 템플릿 표는 컬럼이 고정이므로 `lockColumns` 가 기본 켜짐이다(FRT-104) —
 * 열 태그·'열 추가' UI 가 숨는다. 열을 자유롭게 추가하는 표가 필요하면 `{ lockColumns: false }`.
 * 사용자가 직접 만드는 커스텀 표는 이 팩토리가 아니라 `createBlock` 을 거치므로 잠기지 않는다.
 */
export function createRepeatableCell(
  label: string,
  columns: BlockColumnDef[],
  opts?: { collapsed?: boolean; lockColumns?: boolean },
): Block {
  const base = createBlock('repeatable-cell', label, { columns, collapsed: opts?.collapsed })
  return { ...base, lockColumns: opts?.lockColumns ?? true }
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
  }
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
  const cells: Record<string, string | string[]> = {}
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

// 반복 입력 셀 하나가 실제로 채워졌는지. block-utils 는 types 만 import 하는 leaf 라
// 순환 걱정 없이 여기서 export 하고 form-cards·usePlaceholderRow 가 재사용한다(단일 출처).
export function cellFilled(cell: string | string[] | undefined): boolean {
  if (cell === undefined) return false
  return Array.isArray(cell) ? cell.length > 0 : cell.trim() !== ""
}

export function isBlockEmpty(block: Block): boolean {
  const v = block.value
  switch (v.type) {
    case 'text':
    case 'textarea':
      return v.text.trim() === ''
    case 'date':
      return v.date.trim() === ''
    case 'period':
      return v.start.trim() === '' && v.end.trim() === ''
    case 'single-select':
      return v.selected.trim() === ''
    case 'checklist':
      return v.checked.length === 0
    case 'tags':
      return v.tags.length === 0
    case 'link':
      return v.url.trim() === ''
    case 'file':
      return (
        v.fileName.trim() === '' &&
        (v.fileId?.trim() ?? '') === '' &&
        (v.url?.trim() ?? '') === ''
      )
    case 'repeatable-cell':
      // 행이 없거나, 모든 행의 모든 셀이 비어 있으면 empty (FRT-122). 빈 행 하나(방금 '+ 추가'
      // 하거나 placeholder 에 한 글자 썼다 지운 실체화 행)를 non-empty 로 오판해 상세뷰·포트폴리오에
      // '—'만 있는 유령 섹션이 남던 문제를 판정 층위에서 고친다(value/rows 는 그대로 둔다 —
      // 행을 지우면 placeholder 리마운트로 포커스가 날아간다).
      return v.rows.every(row => Object.values(row.cells).every(cell => !cellFilled(cell)))
    case 'table':
      return v.rows.length === 0
    case 'group':
      return (block.children ?? []).every(c => isBlockEmpty(c))
  }
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
