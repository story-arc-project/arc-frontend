"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Block, RepeatableCellBlockValue, BlockRow, BlockColumnDef } from "@/types/archive"
import { cellFilled, createEmptyRow, uid } from "@/lib/utils/block-utils"
import RoleChips from "./RoleChips"
import { usePlaceholderRow } from "./usePlaceholderRow"

interface RepeatableCellBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: RepeatableCellBlockValue) => void
}

export default function RepeatableCellBlock({ block, readOnly, onChange }: RepeatableCellBlockProps) {
  const val = block.value as RepeatableCellBlockValue
  const [newColLabel, setNewColLabel] = useState("")

  // 컬럼 고정 표시(FRT-104). 잠글지 말지는 여기서 데이터를 보고 정하지 않는다 — 저장된 컬럼이
  // 템플릿과 다른 레코드(잠금 이전에 열을 추가·삭제한 경우)는 매퍼(injectValue)가 이미 잠금을
  // 풀어서 넘긴다. 여기서 val.columns 를 다시 보면 사용자가 열을 추가하는 순간 잠겨 갇힌다.
  const lockColumns = block.lockColumns === true

  // FRT-103: rows 가 비면 표시용 행 하나를 파생한다(value 에는 커밋되지 않음).
  // 항목 수·'행 추가' 노출은 계속 진짜 `val.rows` 를 본다.
  const { displayRows, hasPlaceholder, isPlaceholderRow, materialize } = usePlaceholderRow(
    val.rows,
    val.columns,
  )

  function addRow() {
    const row = createEmptyRow(val.columns)
    onChange({ ...val, rows: [...val.rows, row] })
  }

  function removeRow(rowId: string) {
    onChange({ ...val, rows: val.rows.filter(r => r.id !== rowId) })
  }

  function updateCell(rowId: string, colKey: string, cellValue: string | string[]) {
    if (isPlaceholderRow(rowId)) {
      // FRT-103: 값이 실제로 채워질 때만 실체화한다(빈 값 선택으로는 커밋하지 않는다).
      // 모든 컬럼 타입이 이 콜백 하나를 지나므로 타입별 분기가 필요 없다.
      const row = materialize(rowId, colKey, cellValue)
      if (row) onChange({ ...val, rows: [row] })
      return
    }
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
    // FRT-122: 셀이 전부 빈 행은 상세뷰에서 감춘다. 채운 행과 빈 행이 섞인 블록(행 하나 채우고
    // '행 추가'만 한 경우)에서 빈 행이 '—'만 있는 유령 행으로 남던 문제를 판정 층위에서 고친다.
    // value(rows)는 그대로 둔다 — 편집 모드로 돌아가면 빈 행이 다시 보인다.
    const visibleRows = val.rows.filter(row => Object.values(row.cells).some(cellFilled))
    return (
      <div className="flex flex-col gap-3 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {visibleRows.length === 0 ? (
          <p className="text-body text-text-disabled">—</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleRows.map((row, idx) => (
              <div
                key={row.id}
                className={[
                  "border border-border rounded-lg p-4",
                  idx % 2 === 0 ? "bg-surface" : "bg-surface-secondary",
                ].join(" ")}
              >
                <span className="text-caption text-text-tertiary font-semibold mb-2 block">#{idx + 1}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {val.columns.map(col => {
                    const cellVal = row.cells[col.key]
                    const display = Array.isArray(cellVal) ? cellVal.join(", ") : cellVal
                    return (
                      <div key={col.key} className="flex flex-col gap-0.5">
                        <span className="text-caption text-text-tertiary font-medium">{col.label}</span>
                        {display
                          ? <span className="text-body-sm text-text-primary whitespace-pre-wrap">{display}</span>
                          : <span className="text-body-sm text-text-disabled">—</span>}
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
        <span className="text-field-label text-text-primary">{block.label}</span>
        <span className="text-caption text-text-tertiary">{val.rows.length}개 항목</span>
      </div>

      {/* 블록 레벨 가이드 — 라벨과 입력 사이(컬럼 레벨 가이드와 별개). */}
      {block.guide && (
        <p className="text-caption text-text-tertiary">{block.guide}</p>
      )}

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
          {/* Column tags — 컬럼이 고정된 표(기본 템플릿)에서는 숨긴다. 각 행이 col.label 을 라벨로 그리므로 입력 맥락은 남는다. */}
          {!lockColumns && (
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
          )}

          {/* Rows — 빈 상태에서는 표시용 행 하나(FRT-103). */}
          {displayRows.map((row, idx) => (
            <RowEditor
              key={row.id}
              row={row}
              index={idx}
              columns={val.columns}
              isPlaceholder={isPlaceholderRow(row.id)}
              onCellChange={(colKey, cellVal) => updateCell(row.id, colKey, cellVal)}
              onRemove={() => removeRow(row.id)}
            />
          ))}

          {/* FRT-103: 표시용 빈 행이 있을 때만 '행 추가' 를 숨긴다(할 일이 없다). */}
          {!hasPlaceholder && (
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
          )}
        </>
      )}
    </div>
  )
}

function RowEditor({
  row,
  index,
  columns,
  isPlaceholder,
  onCellChange,
  onRemove,
}: {
  row: BlockRow
  index: number
  columns: RepeatableCellBlockValue["columns"]
  /** FRT-103: 아직 value 에 커밋되지 않은 표시용 행. 지울 실체가 없어 삭제 버튼을 숨긴다. */
  isPlaceholder?: boolean
  onCellChange: (colKey: string, value: string | string[]) => void
  onRemove: () => void
}) {
  return (
    // data-row-id: FRT-76 '프로젝트로 연결' 스크롤 앵커(전역 유일 row.id 로 scrollIntoView).
    <div data-row-id={row.id} className="scroll-mt-20 bg-surface-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption text-text-tertiary">#{index + 1}</span>
        {!isPlaceholder && (
          <button
            type="button"
            onClick={onRemove}
            className="text-text-tertiary hover:text-error transition-colors p-1 rounded"
            aria-label="행 삭제"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {columns.map(col => {
          const cellVal = row.cells[col.key]
          const isWide =
            col.blockType === "textarea" ||
            col.blockType === "tags" ||
            col.blockType === "checklist"

          return (
            <div key={col.key} className={`flex flex-col gap-1.5 ${isWide ? "sm:col-span-2" : ""}`}>
              <label className="text-caption text-text-secondary">
                {col.label}
                {col.required && <span className="text-error ml-0.5">*</span>}
              </label>
              {col.guide && index === 0 && (
                <p className="text-caption text-text-tertiary">{col.guide}</p>
              )}
              <CellInput
                column={col}
                value={cellVal}
                onChange={(v) => onCellChange(col.key, v)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CellInput({
  column,
  value,
  onChange,
}: {
  column: BlockColumnDef
  value: string | string[] | undefined
  onChange: (value: string | string[]) => void
}) {
  // 열 타입이 변경되어 기존 값(string ↔ string[])이 불일치할 때 UI에서 값이 사라지지 않도록 정규화한다.
  const strVal = Array.isArray(value) ? value.join(", ") : (value ?? "")
  const arrVal = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
      : []

  if (column.blockType === "textarea") {
    return (
      <textarea
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none resize-none min-h-[64px]"
        placeholder={column.placeholder}
        value={strVal}
        onChange={e => onChange(e.target.value)}
      />
    )
  }

  if (column.blockType === "date") {
    return (
      <input
        type="date"
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        value={strVal}
        onChange={e => onChange(e.target.value)}
      />
    )
  }

  if (column.blockType === "link") {
    return (
      <input
        type="url"
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        placeholder={column.placeholder ?? "https://..."}
        value={strVal}
        onChange={e => onChange(e.target.value)}
      />
    )
  }

  if (column.blockType === "tags") {
    return <TagsCellInput value={arrVal} onChange={onChange} placeholder={column.placeholder} />
  }

  if (column.blockType === "checklist") {
    // FRT-178: 역할 칩 컬럼은 옵션이 상수가 아니라 폼의 '역할 이력'에서 파생된다.
    // 자유 태그 입력으로 폴백하면 등록되지 않은 역할이 생겨 동기화가 성립하지 않는다.
    if (column.variant === "role-chip") {
      return <RoleChips value={arrVal} onChange={onChange} />
    }
    const options = column.options ?? []
    if (options.length === 0) {
      // Fallback: free-form checklist entries (treated as tags)
      return <TagsCellInput value={arrVal} onChange={onChange} placeholder={column.placeholder ?? "항목 입력 후 Enter"} />
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {options.map(opt => {
          const checked = arrVal.includes(opt)
          return (
            <label key={opt} className="flex items-center gap-1.5 text-body-sm text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(checked ? arrVal.filter(v => v !== opt) : [...arrVal, opt])
                }
                className="rounded border-border text-brand focus:ring-brand"
              />
              {opt}
            </label>
          )
        })}
      </div>
    )
  }

  if (column.blockType === "single-select") {
    const options = column.options ?? []
    return (
      <select
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary focus:border-brand focus:outline-none"
        value={strVal}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">선택</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  // Default: text input
  return (
    <input
      type="text"
      className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
      placeholder={column.placeholder}
      value={strVal}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function TagsCellInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState("")

  function add() {
    const t = input.trim()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setInput("")
  }

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 bg-surface-brand text-brand-dark rounded-full pl-2.5 pr-1.5 py-0.5 text-caption font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter(v => v !== tag))}
                className="rounded-full p-0.5 hover:bg-brand-light transition-colors text-brand-dark"
                aria-label={`${tag} 삭제`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        placeholder={placeholder ?? "입력 후 Enter"}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        onBlur={add}
      />
    </div>
  )
}
