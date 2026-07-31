"use client"

import { useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"
import type { Block, BlockRow, RepeatableCellBlockValue } from "@/types/archive"
import { cellText, createEmptyRow } from "@/lib/utils/block-utils"
import { useRoleHistory } from "@/contexts/RoleHistoryContext"
import { usePlaceholderRow } from "./usePlaceholderRow"

interface RoleHistoryBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: RepeatableCellBlockValue) => void
}

function cellOf(row: BlockRow, key: string): string {
  return cellText(row.cells[key])
}

function roleOf(row: BlockRow): string {
  return cellOf(row, "role").trim()
}

/**
 * 이 UI 로 그릴 수 있는 값인가. `role` 컬럼이 없으면 역할명을 읽을 자리가 없어
 * 패널이 이름을 하나도 만들어내지 못한다(입력해도 사라지는 칸이 된다) — 그때는 표형으로 폴백한다.
 * BlockRenderer 의 폴백 판정과 여기 렌더가 같은 계산을 쓰게 하려고 export 한다(FRT-177 교훈).
 */
export function hasRoleHistoryShape(block: Block): boolean {
  return (
    block.value.type === "repeatable-cell" &&
    block.value.columns.some(c => c.key === "role")
  )
}

/**
 * 접이식 역할 이력 패널(FRT-178). ① '역할 / 직책' 아래에 딸리는 확장 입력이며,
 * 여기 등록된 역할명이 폼 안 모든 역할 칩의 선택지가 된다.
 * 값 shape 은 3컬럼 `repeatable-cell` 그대로이고 `block.variant === 'role-history'` 일 때
 * RepeatableCellBlock 대신 이 UI 로 렌더된다(무마이그레이션, OutcomeList 와 같은 패턴).
 */
export default function RoleHistoryBlock({ block, readOnly, onChange }: RoleHistoryBlockProps) {
  const val = block.value as RepeatableCellBlockValue
  const rows = val.rows
  const ctx = useRoleHistory()
  // 이미 기록이 있으면 접어두지 않는다 — 접힌 채로 두면 입력한 값이 화면에서 사라져 보인다.
  const [open, setOpen] = useState(rows.length > 0)
  // FRT-103: rows 가 비면 표시용 행 하나를 파생한다(value 에는 커밋되지 않음).
  // 이게 없으면 패널을 열어도 입력칸이 없고 '역할 추가' 버튼만 놓인 빈 상자가 된다.
  const { displayRows, hasPlaceholder, isPlaceholderRow, materialize } = usePlaceholderRow(
    rows,
    val.columns,
  )

  function commit(nextRows: BlockRow[]) {
    onChange({ ...val, rows: nextRows })
  }

  function roleOfId(rowId: string): string {
    const row = rows.find(r => r.id === rowId)
    return row ? roleOf(row) : ""
  }

  /**
   * 행별 '마지막으로 유효했던 역할명'. 이름을 비운 뒤 그 행을 지우면 셀에서는 지울 이름을
   * 읽을 수 없어(빈 문자열) 태그가 영영 고아로 남는다 — 그때 쓰려고 들고 있는다.
   * 커밋 이후에 기록하므로 삭제 클릭 시점에는 항상 직전 유효값이 들어 있다.
   */
  const lastNamesRef = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    for (const r of rows) {
      const name = roleOf(r)
      if (name) lastNamesRef.current.set(r.id, name)
    }
  }, [rows])

  /**
   * 그 이름을 아직 다른 행이 갖고 있는가. 같은 역할명이 두 행에 걸칠 수 있으므로
   * (예: 회장 재선출로 2023·2024 두 시기 모두 '회장') 남아 있으면 전파하지 않는다 —
   * 그러지 않으면 아직 유효한 역할의 태그까지 함께 지워지거나 이름이 바뀐다.
   */
  function heldByOtherRow(name: string, exceptRowId: string): boolean {
    return rows.some(r => r.id !== exceptRowId && roleOf(r) === name)
  }

  /**
   * ⚠️ 역할명 전파는 **편집이 끝난 시점**에만 한다(키 입력마다 하지 않는다).
   * 이름을 지우고 새로 치는 평범한 편집에서, 텍스트가 빈 순간 `renameRole(name, '')` 이 나가면
   * 태그가 통째로 사라지고 새 이름을 다 친 뒤엔 이어붙일 옛 이름이 없어 복구가 불가능하다.
   * 그래서 포커스 시점의 이름을 기억해 두고 blur 에서 한 번만 대조한다.
   */
  const editingRef = useRef<{ id: string; before: string } | null>(null)

  function beginRoleEdit(rowId: string) {
    editingRef.current = { id: rowId, before: roleOfId(rowId) }
  }

  function endRoleEdit(rowId: string) {
    const started = editingRef.current
    editingRef.current = null
    if (!ctx || !started || started.id !== rowId) return
    const before = started.before
    const after = roleOfId(rowId)
    if (!before || after === before) return
    // 이름을 비운 채 나간 건 "역할이 사라졌다"는 확정이 아니다. 지우면 되돌릴 수 없지만
    // 고아로 두면 회색 뱃지로 남고 같은 이름을 다시 입력하는 순간 정상 태그로 되살아난다.
    if (!after) return
    if (heldByOtherRow(before, rowId)) return
    ctx.renameRole(before, after)
  }

  function updateCell(rowId: string, key: string, text: string) {
    if (isPlaceholderRow(rowId)) {
      // FRT-103: 실제로 값이 채워질 때만 실체화한다. 같은 id 로 커밋하므로 렌더 key 가 그대로라
      // 리마운트가 없다(포커스·한글 IME 조합 보존).
      const row = materialize(rowId, key, text)
      if (row) commit([row])
      return
    }
    commit(rows.map(r => (r.id === rowId ? { ...r, cells: { ...r.cells, [key]: text } } : r)))
  }

  function addRow() {
    commit([...rows, createEmptyRow(val.columns)])
  }

  /** 행 삭제는 명시적 확정이라 즉시 전파한다(타이핑 중간 상태와 달리 되돌릴 여지가 없다). */
  function removeRow(rowId: string) {
    const name = roleOfId(rowId) || lastNamesRef.current.get(rowId) || ""
    if (ctx && name && !heldByOtherRow(name, rowId)) ctx.removeRole(name)
    lastNamesRef.current.delete(rowId)
    commit(rows.filter(r => r.id !== rowId))
  }

  if (readOnly) {
    const filled = rows.filter(r => roleOf(r))
    if (filled.length === 0) return null
    return (
      <div className="flex flex-col gap-1.5 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption font-semibold tracking-wide text-text-tertiary">{block.label}</span>
        <ul className="flex flex-col gap-1">
          {filled.map(r => {
            const period = [cellOf(r, "start"), cellOf(r, "end")].filter(Boolean).join(" – ")
            return (
              <li key={r.id} className="text-body-sm text-text-primary">
                {period && <span className="text-text-tertiary">{period} · </span>}
                {roleOf(r)}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 w-fit items-center gap-1 rounded-md border border-dashed border-border px-3 text-body-sm text-text-secondary transition-colors hover:border-brand hover:text-brand sm:min-h-9"
      >
        <Plus size={14} />
        역할 이력 상세 기록
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-secondary p-4">
      <span className="text-field-label text-text-primary">{block.label}</span>
      {block.guide && <p className="text-caption text-text-tertiary">{block.guide}</p>}

      <div className="flex flex-col gap-2">
        {displayRows.map(row => (
          <div key={row.id} className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={cellOf(row, "start")}
              onChange={e => updateCell(row.id, "start", e.target.value)}
              aria-label="역할 시작 시점"
              className="h-9 rounded-md border border-border bg-surface px-2 text-body-sm text-text-primary focus:border-brand focus:outline-none"
            />
            <span className="text-text-tertiary">–</span>
            <input
              type="month"
              value={cellOf(row, "end")}
              onChange={e => updateCell(row.id, "end", e.target.value)}
              aria-label="역할 종료 시점"
              className="h-9 rounded-md border border-border bg-surface px-2 text-body-sm text-text-primary focus:border-brand focus:outline-none"
            />
            <input
              type="text"
              value={cellOf(row, "role")}
              onChange={e => updateCell(row.id, "role", e.target.value)}
              onFocus={() => beginRoleEdit(row.id)}
              onBlur={() => endRoleEdit(row.id)}
              placeholder="역할명 (예: 공연팀장)"
              aria-label="역할명"
              className="h-9 min-w-32 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            />
            {/* FRT-103: 아직 실체가 없는 표시용 행에는 지울 대상이 없다(죽은 버튼이 된다). */}
            {!isPlaceholderRow(row.id) && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="shrink-0 rounded p-1 text-text-tertiary transition-colors hover:text-error"
                aria-label={`${roleOf(row) || "역할"} 삭제`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 이미 빈 줄이 있을 때만 '추가'를 숨긴다(눌러도 화면이 그대로라 고장으로 읽힌다). */}
      {!hasPlaceholder && (
        <button
          type="button"
          onClick={addRow}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-body-sm text-text-secondary transition-colors hover:text-brand sm:min-h-9"
        >
          <Plus size={16} />
          역할 추가
        </button>
      )}
    </div>
  )
}
