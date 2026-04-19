"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { BlockType, BlockColumnDef } from "@/types/archive"
import { uid } from "@/lib/utils/block-utils"

export interface BlockEditConfig {
  label: string
  placeholder?: string
  options?: string[]
  columns?: BlockColumnDef[]
  tableColumns?: string[]
}

interface BlockEditModalProps {
  open: boolean
  blockType: BlockType | null
  initialConfig?: BlockEditConfig
  onClose: () => void
  onConfirm: (config: BlockEditConfig) => void
}

const TYPE_LABELS: Partial<Record<BlockType, string>> = {
  text: "텍스트 (짧은)",
  textarea: "텍스트 (긴)",
  checklist: "체크리스트",
  "single-select": "단일 선택",
  date: "날짜",
  period: "기간",
  tags: "태그",
  link: "링크",
  file: "파일 첨부",
  "repeatable-cell": "반복 셀 (로그형)",
  table: "표 (그리드)",
}

export default function BlockEditModal({
  open,
  blockType,
  initialConfig,
  onClose,
  onConfirm,
}: BlockEditModalProps) {
  const [label, setLabel] = useState(initialConfig?.label ?? "")
  const [placeholder, setPlaceholder] = useState(initialConfig?.placeholder ?? "")
  const [options, setOptions] = useState<string[]>(initialConfig?.options ?? [])
  const [newOption, setNewOption] = useState("")
  const [columns, setColumns] = useState<BlockColumnDef[]>(initialConfig?.columns ?? [])
  const [newColLabel, setNewColLabel] = useState("")
  const [tableColumns, setTableColumns] = useState<string[]>(initialConfig?.tableColumns ?? [])
  const [newTableCol, setNewTableCol] = useState("")

  // Reset state when modal opens with new config (adjust state during render)
  const [prevResetKey, setPrevResetKey] = useState("")
  const resetKey = open ? `${blockType}-${initialConfig?.label ?? ""}-${initialConfig?.placeholder ?? ""}-${(initialConfig?.options ?? []).join(",")}` : ""
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    if (open) {
      setLabel(initialConfig?.label ?? "")
      setPlaceholder(initialConfig?.placeholder ?? "")
      setOptions(initialConfig?.options ?? [])
      setNewOption("")
      setColumns(initialConfig?.columns ?? [])
      setNewColLabel("")
      setTableColumns(initialConfig?.tableColumns ?? [])
      setNewTableCol("")
    }
  }

  const handleConfirm = () => {
    if (!label.trim()) return
    onConfirm({
      label: label.trim(),
      placeholder: placeholder.trim() || undefined,
      options: options.length > 0 ? options : undefined,
      columns: columns.length > 0 ? columns : undefined,
      tableColumns: tableColumns.length > 0 ? tableColumns : undefined,
    })
  }

  const needsOptions = blockType === "single-select" || blockType === "checklist"
  const needsColumns = blockType === "repeatable-cell"
  const needsTableCols = blockType === "table"
  const needsPlaceholder = blockType === "text" || blockType === "textarea"

  if (!open || !blockType) return null

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="블록 설정" className="max-w-md">
      <h3 className="text-title text-text-primary mb-1">
        {initialConfig ? "블록 수정" : "블록 추가"}
      </h3>
      <p className="text-caption text-text-tertiary mb-5">
        {TYPE_LABELS[blockType] ?? blockType}
      </p>

      <div className="flex flex-col gap-4">
        {/* Block name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label text-text-primary">블록 이름 *</label>
          <input
            type="text"
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            placeholder="블록 이름을 입력하세요"
            value={label}
            onChange={e => setLabel(e.target.value)}
            autoFocus
          />
        </div>

        {/* Placeholder (text/textarea) */}
        {needsPlaceholder && (
          <div className="flex flex-col gap-1.5">
            <label className="text-label text-text-primary">플레이스홀더</label>
            <input
              type="text"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="안내 텍스트 (선택)"
              value={placeholder}
              onChange={e => setPlaceholder(e.target.value)}
            />
          </div>
        )}

        {/* Options (single-select / checklist) */}
        {needsOptions && (
          <div className="flex flex-col gap-1.5">
            <label className="text-label text-text-primary">옵션 목록</label>
            <div className="flex flex-col gap-1">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex-1 text-body-sm text-text-primary truncate bg-surface-secondary rounded px-2 py-1">{opt}</span>
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                    className="p-1 text-text-tertiary hover:text-error transition-colors"
                    aria-label="옵션 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="h-9 flex-1 min-w-0 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                placeholder="옵션 추가..."
                value={newOption}
                onChange={e => setNewOption(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const t = newOption.trim()
                    if (t && !options.includes(t)) {
                      setOptions([...options, t])
                      setNewOption("")
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const t = newOption.trim()
                  if (t && !options.includes(t)) {
                    setOptions([...options, t])
                    setNewOption("")
                  }
                }}
                className="h-9 rounded-md border border-border bg-surface px-2 text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Columns (repeatable-cell) */}
        {needsColumns && (
          <div className="flex flex-col gap-1.5">
            <label className="text-label text-text-primary">열 정의</label>
            <div className="flex flex-col gap-1">
              {columns.map((col, idx) => (
                <div key={col.key} className="flex items-center gap-2">
                  <span className="flex-1 text-body-sm text-text-primary truncate bg-surface-secondary rounded px-2 py-1">{col.label}</span>
                  <select
                    value={col.blockType}
                    onChange={e => setColumns(columns.map((c, i) => i === idx ? { ...c, blockType: e.target.value as BlockColumnDef["blockType"] } : c))}
                    className="h-7 rounded border border-border bg-surface px-1 text-caption text-text-secondary"
                  >
                    <option value="text">짧은 텍스트</option>
                    <option value="textarea">긴 텍스트</option>
                    <option value="date">날짜</option>
                    <option value="link">링크</option>
                    <option value="tags">태그</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setColumns(columns.filter((_, i) => i !== idx))}
                    className="p-1 text-text-tertiary hover:text-error transition-colors"
                    aria-label="열 삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="h-9 flex-1 min-w-0 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                placeholder="열 이름 추가..."
                value={newColLabel}
                onChange={e => setNewColLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const t = newColLabel.trim()
                    if (t) {
                      setColumns([...columns, { key: uid("col"), label: t, blockType: "text" }])
                      setNewColLabel("")
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const t = newColLabel.trim()
                  if (t) {
                    setColumns([...columns, { key: uid("col"), label: t, blockType: "text" }])
                    setNewColLabel("")
                  }
                }}
                className="h-9 rounded-md border border-border bg-surface px-2 text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Table columns */}
        {needsTableCols && (
          <div className="flex flex-col gap-1.5">
            <label className="text-label text-text-primary">열 이름</label>
            <div className="flex flex-wrap gap-1.5">
              {tableColumns.map((col, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-surface-secondary border border-border rounded-full pl-2.5 pr-1.5 py-0.5 text-caption text-text-secondary"
                >
                  {col}
                  <button
                    type="button"
                    onClick={() => setTableColumns(tableColumns.filter((_, i) => i !== idx))}
                    className="rounded-full p-0.5 hover:bg-surface-tertiary transition-colors text-text-tertiary hover:text-error"
                    aria-label={`${col} 삭제`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="h-9 flex-1 min-w-0 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                placeholder="열 이름 추가..."
                value={newTableCol}
                onChange={e => setNewTableCol(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const t = newTableCol.trim()
                    if (t && !tableColumns.includes(t)) {
                      setTableColumns([...tableColumns, t])
                      setNewTableCol("")
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const t = newTableCol.trim()
                  if (t && !tableColumns.includes(t)) {
                    setTableColumns([...tableColumns, t])
                    setNewTableCol("")
                  }
                }}
                className="h-9 rounded-md border border-border bg-surface px-2 text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-end mt-6">
        <Button variant="ghost" size="sm" onClick={onClose}>
          취소
        </Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!label.trim()}>
          확인
        </Button>
      </div>
    </Dialog>
  )
}
