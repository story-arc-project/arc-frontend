"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Block, RepeatableCellBlockValue, BlockRow } from "@/types/archive"
import { createEmptyRow } from "@/lib/block-utils"

interface RepeatableCellBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: RepeatableCellBlockValue) => void
}

export default function RepeatableCellBlock({ block, readOnly, onChange }: RepeatableCellBlockProps) {
  const val = block.value as RepeatableCellBlockValue

  function addRow() {
    const row = createEmptyRow(val.columns)
    onChange({ ...val, rows: [...val.rows, row] })
  }

  function removeRow(rowId: string) {
    onChange({ ...val, rows: val.rows.filter(r => r.id !== rowId) })
  }

  function updateCell(rowId: string, colKey: string, cellValue: string) {
    onChange({
      ...val,
      rows: val.rows.map(r =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colKey]: cellValue } } : r
      ),
    })
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-3">
        <span className="text-label text-text-secondary">{block.label}</span>
        {val.rows.length === 0 ? (
          <p className="text-body text-text-tertiary">—</p>
        ) : (
          <div className="flex flex-col gap-3">
            {val.rows.map((row, idx) => (
              <div
                key={row.id}
                className="bg-surface-secondary border border-border rounded-lg p-4"
              >
                <span className="text-caption text-text-tertiary mb-2 block">#{idx + 1}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {val.columns.map(col => {
                    const cellVal = row.cells[col.key]
                    const display = Array.isArray(cellVal) ? cellVal.join(", ") : cellVal
                    return (
                      <div key={col.key} className="flex flex-col gap-0.5">
                        <span className="text-caption text-text-tertiary">{col.label}</span>
                        <span className="text-body-sm text-text-primary">{display || "—"}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-label text-text-primary">{block.label}</span>
        <span className="text-caption text-text-tertiary">{val.rows.length}개 항목</span>
      </div>

      {val.rows.map((row, idx) => (
        <RowEditor
          key={row.id}
          row={row}
          index={idx}
          columns={val.columns}
          onCellChange={(colKey, cellVal) => updateCell(row.id, colKey, cellVal)}
          onRemove={() => removeRow(row.id)}
        />
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addRow}
        className="self-start"
      >
        <Plus size={16} className="mr-1" />
        행 추가
      </Button>
    </div>
  )
}

function RowEditor({
  row,
  index,
  columns,
  onCellChange,
  onRemove,
}: {
  row: BlockRow
  index: number
  columns: RepeatableCellBlockValue["columns"]
  onCellChange: (colKey: string, value: string) => void
  onRemove: () => void
}) {
  return (
    <div className="bg-surface-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption text-text-tertiary">#{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-text-tertiary hover:text-error transition-colors p-1 rounded"
          aria-label="행 삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {columns.map(col => {
          const cellVal = row.cells[col.key]
          const strVal = Array.isArray(cellVal) ? cellVal.join(", ") : (cellVal ?? "")
          const isLong = col.blockType === "textarea"

          return (
            <div key={col.key} className={`flex flex-col gap-1.5 ${isLong ? "sm:col-span-2" : ""}`}>
              <label className="text-caption text-text-secondary">
                {col.label}
                {col.required && <span className="text-error ml-0.5">*</span>}
              </label>
              {isLong ? (
                <textarea
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none resize-none min-h-[64px]"
                  placeholder={col.placeholder}
                  value={strVal}
                  onChange={e => onCellChange(col.key, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                  placeholder={col.placeholder}
                  value={strVal}
                  onChange={e => onCellChange(col.key, e.target.value)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
