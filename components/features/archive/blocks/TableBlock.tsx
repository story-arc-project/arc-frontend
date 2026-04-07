"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Block, TableBlockValue } from "@/types/archive"

interface TableBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: TableBlockValue) => void
}

export default function TableBlock({ block, readOnly, onChange }: TableBlockProps) {
  const val = block.value as TableBlockValue
  const [newCol, setNewCol] = useState("")

  function addColumn() {
    const trimmed = newCol.trim()
    if (!trimmed || val.columns.includes(trimmed)) return
    onChange({
      ...val,
      columns: [...val.columns, trimmed],
      rows: val.rows.map(row => [...row, ""]),
    })
    setNewCol("")
  }

  function addRow() {
    onChange({ ...val, rows: [...val.rows, val.columns.map(() => "")] })
  }

  function removeRow(idx: number) {
    onChange({ ...val, rows: val.rows.filter((_, i) => i !== idx) })
  }

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    const newRows = val.rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : row
    )
    onChange({ ...val, rows: newRows })
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-text-secondary">{block.label}</span>
        {val.columns.length === 0 ? (
          <p className="text-body text-text-tertiary">—</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border">
                  {val.columns.map(col => (
                    <th key={col} className="text-left text-caption text-text-secondary font-medium px-3 py-2">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {val.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-border last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-text-primary">{cell || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-label text-text-primary">{block.label}</span>

      {val.columns.length === 0 ? (
        <div className="flex gap-2">
          <input
            type="text"
            className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            placeholder="첫 번째 열 이름..."
            value={newCol}
            onChange={e => setNewCol(e.target.value)}
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
      ) : (
        <>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="bg-surface-secondary">
                  {val.columns.map(col => (
                    <th key={col} className="text-left text-caption text-text-secondary font-medium px-3 py-2">{col}</th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {val.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-border">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-1 py-1">
                        <input
                          type="text"
                          className="h-8 w-full rounded border-0 bg-transparent px-2 text-body-sm text-text-primary focus:bg-surface-secondary focus:outline-none"
                          value={cell}
                          onChange={e => updateCell(ri, ci, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => removeRow(ri)}
                        className="text-text-tertiary hover:text-error transition-colors p-1 rounded"
                        aria-label="행 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={addRow} className="self-start">
              <Plus size={16} className="mr-1" />
              행 추가
            </Button>
            <div className="flex gap-2 ml-auto">
              <input
                type="text"
                className="h-9 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                placeholder="열 추가..."
                value={newCol}
                onChange={e => setNewCol(e.target.value)}
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
        </>
      )}
    </div>
  )
}
