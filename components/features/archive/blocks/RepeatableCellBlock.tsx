"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Block, RepeatableCellBlockValue, BlockRow, BlockColumnDef } from "@/types/archive"
import { createEmptyRow, uid } from "@/lib/block-utils"

interface RepeatableCellBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: RepeatableCellBlockValue) => void
}

export default function RepeatableCellBlock({ block, readOnly, onChange }: RepeatableCellBlockProps) {
  const val = block.value as RepeatableCellBlockValue
  const [newColLabel, setNewColLabel] = useState("")

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

  function addColumn() {
    const trimmed = newColLabel.trim()
    if (!trimmed) return
    const newCol: BlockColumnDef = {
      key: uid("col"),
      label: trimmed,
      blockType: "text",
    }
    onChange({
      ...val,
      columns: [...val.columns, newCol],
      rows: val.rows.map(r => ({ ...r, cells: { ...r.cells, [newCol.key]: "" } })),
    })
    setNewColLabel("")
  }

  function removeColumn(colKey: string) {
    onChange({
      ...val,
      columns: val.columns.filter(c => c.key !== colKey),
      rows: val.rows.map(r => {
        const cells = { ...r.cells }
        delete cells[colKey]
        return { ...r, cells }
      }),
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

      {/* Column configuration (when no columns or for management) */}
      {val.columns.length === 0 ? (
        <div className="bg-surface-secondary border border-dashed border-border rounded-lg p-4">
          <p className="text-body-sm text-text-tertiary mb-3">열(필드)을 추가해주세요</p>
          <div className="flex gap-2">
            <input
              type="text"
              className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="열 이름..."
              value={newColLabel}
              onChange={e => setNewColLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addColumn() } }}
            />
            <button
              type="button"
              onClick={addColumn}
              className="h-9 rounded-md border border-border bg-surface px-3 text-body-sm text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              열 추가
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Column tags */}
          <div className="flex flex-wrap gap-1.5">
            {val.columns.map(col => (
              <span
                key={col.key}
                className="inline-flex items-center gap-1 bg-surface-secondary border border-border rounded-full pl-2.5 pr-1.5 py-0.5 text-caption text-text-secondary"
              >
                {col.label}
                <button
                  type="button"
                  onClick={() => removeColumn(col.key)}
                  className="rounded-full p-0.5 hover:bg-surface-tertiary transition-colors text-text-tertiary hover:text-error"
                  aria-label={`${col.label} 열 삭제`}
                >
                  ×
                </button>
              </span>
            ))}
            <div className="flex gap-1">
              <input
                type="text"
                className="h-6 w-24 rounded border border-border bg-surface px-2 text-caption text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                placeholder="열 추가..."
                value={newColLabel}
                onChange={e => setNewColLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addColumn() } }}
              />
            </div>
          </div>

          {/* Rows */}
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
        </>
      )}
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
