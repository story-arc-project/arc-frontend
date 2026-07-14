import type {
  Block,
  BlockType,
  BlockValue,
  BlockRow,
  BlockColumnDef,
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

export function createRepeatableCell(
  label: string,
  columns: BlockColumnDef[],
  opts?: { collapsed?: boolean },
): Block {
  return createBlock('repeatable-cell', label, { columns, collapsed: opts?.collapsed })
}

export function createTableField(label: string): Block {
  return createBlock('table', label)
}

/**
 * 개조식 불릿-행 입력(FRT-97). 저장은 단일컬럼 `repeatable-cell` 그대로 두고
 * `variant: 'outcome-list'` 마커로 OutcomeList UI 를 지정한다(무마이그레이션).
 * 컬럼 key 는 `'item'` 고정 — OutcomeList 가 이 키의 텍스트를 각 행 값으로 읽는다.
 */
export function createOutcomeList(
  label: string,
  opts?: { placeholder?: string; guide?: string },
): Block {
  const base = createRepeatableCell(label, [
    { key: 'item', label: '활동 / 성과', blockType: 'text', placeholder: opts?.placeholder },
  ])
  return { ...base, variant: 'outcome-list', guide: opts?.guide }
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
      return v.rows.length === 0
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
