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

function emptyValue(type: BlockType, opts?: { options?: string[]; columns?: BlockColumnDef[] }): BlockValue {
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
  type: BlockType,
  label: string,
  opts?: {
    required?: boolean
    placeholder?: string
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
    options: opts?.options,
    value: emptyValue(type, opts),
  }
}

export function createTextField(label: string, opts?: { required?: boolean; placeholder?: string }): Block {
  return createBlock('text', label, opts)
}

export function createTextareaField(label: string, opts?: { required?: boolean; placeholder?: string }): Block {
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

export function createTagsField(label: string, opts?: { required?: boolean }): Block {
  return createBlock('tags', label, opts)
}

export function createLinkField(label: string, opts?: { required?: boolean; placeholder?: string }): Block {
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
  return {
    ...JSON.parse(JSON.stringify(block)),
    id: uid(),
  }
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
      return v.date === ''
    case 'period':
      return v.start === '' && v.end === ''
    case 'single-select':
      return v.selected === ''
    case 'checklist':
      return v.checked.length === 0
    case 'tags':
      return v.tags.length === 0
    case 'link':
      return v.url.trim() === ''
    case 'file':
      return v.fileName === ''
    case 'repeatable-cell':
      return v.rows.length === 0
    case 'table':
      return v.rows.length === 0
  }
}

export function validateRequiredBlocks(blocks: Block[]): string[] {
  const errors: string[] = []
  for (const block of blocks) {
    if (block.required && isBlockEmpty(block)) {
      errors.push(`"${block.label}" 항목을 입력해주세요.`)
    }
  }
  return errors
}
