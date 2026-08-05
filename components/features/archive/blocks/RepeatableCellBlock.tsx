"use client"

import { useRef, useState, type ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RequiredDot } from "@/components/ui/required-dot"
import type {
  Block,
  RepeatableCellBlockValue,
  BlockRow,
  BlockColumnDef,
  CellValue,
  RowExtraField,
  RowExtraFieldType,
} from "@/types/archive"
import {
  cellFilled,
  cellText,
  createEmptyRow,
  isFileCellValue,
  rowHasContent,
  uid,
} from "@/lib/utils/block-utils"
import {
  formatPeriodString,
  hasDayPrecision,
  isRealDay,
  isRealMonth,
  parsePeriodString,
  truncateToMonth,
} from "@/lib/utils/period-format"
import FileCellInput from "./file/FileCellInput"
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

  // FRT-145: 행마다 '항목 추가'. 열 잠금과 무관하다 — 열은 계속 템플릿이 소유하고(모든 행에 적용),
  // 여기서 열리는 건 그 행 하나에만 붙는 항목이다.
  const allowRowExtras = block.allowRowExtras === true

  // FRT-103: rows 가 비면 표시용 행 하나를 파생한다(value 에는 커밋되지 않음).
  // 항목 수·'행 추가' 노출은 계속 진짜 `val.rows` 를 본다.
  const { displayRows, hasPlaceholder, isPlaceholderRow, materialize, materializeWith } =
    usePlaceholderRow(val.rows, val.columns)

  function addRow() {
    const row = createEmptyRow(val.columns)
    onChange({ ...val, rows: [...val.rows, row] })
  }

  function removeRow(rowId: string) {
    onChange({ ...val, rows: val.rows.filter(r => r.id !== rowId) })
  }

  function updateCell(rowId: string, colKey: string, cellValue: CellValue) {
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

  /**
   * FRT-145: 행에 붙은 사용자 항목만 갈아끼운다. 행을 `{ id, cells }` 로 다시 짜지 않는다 —
   * 그러면 그때 존재하는 다른 행 필드(linkedProjectRowId·roleTags)가 조용히 날아간다(FRT-178).
   */
  function updateRowExtras(rowId: string, next: (fields: RowExtraField[]) => RowExtraField[]) {
    const patch = (row: BlockRow) => ({ extraFields: next(row.extraFields ?? []) })
    if (isPlaceholderRow(rowId)) {
      // 표시용 행에서 항목을 추가하는 경로. 이름이 비면 애초에 항목이 만들어지지 않으므로
      // "실제로 채워졌을 때만 커밋"은 그대로 성립한다.
      const row = materializeWith(rowId, patch)
      if (row) onChange({ ...val, rows: [row] })
      return
    }
    onChange({
      ...val,
      rows: val.rows.map(r => (r.id === rowId ? { ...r, ...patch(r) } : r)),
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
    // FRT-145: 판정은 셀만이 아니라 그 행에 추가된 항목까지 본다(rowHasContent) — 셀만 보면
    // 추가 항목에만 값을 쓴 행이 유령으로 분류돼 사용자가 쓴 값이 조회 화면에서 사라진다.
    const visibleRows = val.rows.filter(rowHasContent)
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
                    const display = cellText(cellVal)
                    return (
                      <div key={col.key} className="flex flex-col gap-0.5">
                        <span className="text-caption text-text-tertiary font-medium">{col.label}</span>
                        {/* 파일은 이름만 적으면 받은 사람이 열 수 없다 — 다운로드까지 되는 카드로 보여준다.
                            열 유형이 텍스트로 바뀌어도 값이 첨부면 마찬가지다. 편집칸은 안내를 띄우는데
                            조회만 파일명 글자로 접으면, 보는 사람은 첨부가 있는 줄도 모른다(대칭). */}
                        {col.blockType === "file" || isFileCellValue(cellVal) ? (
                          <>
                            <FileCellInput value={isFileCellValue(cellVal) ? cellVal : undefined} readOnly onChange={() => {}} />
                            {/* 열 유형이 바뀌어 남은 옛 텍스트. 편집칸과 같은 이유로 감추지 않는다. */}
                            {!isFileCellValue(cellVal) && display && <LegacyCellText text={display} />}
                          </>
                        ) : !isSupportedCellType(col.blockType) ? (
                          // 조회 화면은 편집칸을 안 거쳐 경고 분기도 함께 비껴간다 — 보는 사람이
                          // 잘려 보이는 값을 온전한 표시로 오해하지 않게 여기서도 알린다.
                          <>
                            <span className="text-body-sm text-text-primary whitespace-pre-wrap">{display || "—"}</span>
                            <span className="text-caption text-text-tertiary">
                              아직 지원하지 않는 입력 유형이에요 — 저장된 값을 그대로 보여줘요.
                            </span>
                          </>
                        ) : display ? (
                          <span className="text-body-sm text-text-primary whitespace-pre-wrap">{display}</span>
                        ) : (
                          <span className="text-body-sm text-text-disabled">—</span>
                        )}
                      </div>
                    )
                  })}
                  {/* FRT-145: 이 행에만 추가된 항목. 값이 빈 항목은 감춘다(빈 행 필터와 같은 철학 —
                      value 는 그대로 두고 판정 층위에서 거른다). */}
                  {(row.extraFields ?? [])
                    .filter(f => cellFilled(f.value))
                    .map(f => (
                      <div key={f.key} className="flex flex-col gap-0.5">
                        <span className="text-caption text-text-tertiary font-medium">{f.label}</span>
                        <span className="text-body-sm text-text-primary whitespace-pre-wrap">
                          {Array.isArray(f.value) ? f.value.join(", ") : f.value}
                        </span>
                      </div>
                    ))}
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
      {/*
        `N개 항목` 은 **라벨 바로 옆**에 둔다 — 오른쪽 끝으로 밀면 블록 우상단을 차지해
        숨김 × 가 들어갈 자리가 없어지고, × 를 카드 여백까지 밀어내면 테두리에 몰려 보인다.
        라벨과 붙여 읽는 편이 "이 블록에 몇 개 있는지" 로도 자연스럽다.
      */}
      <div className="flex items-center gap-2">
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
              allowRowExtras={allowRowExtras}
              onCellChange={(colKey, cellVal) => updateCell(row.id, colKey, cellVal)}
              onExtrasChange={next => updateRowExtras(row.id, next)}
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
  allowRowExtras,
  onCellChange,
  onExtrasChange,
  onRemove,
}: {
  row: BlockRow
  index: number
  columns: RepeatableCellBlockValue["columns"]
  /** FRT-103: 아직 value 에 커밋되지 않은 표시용 행. 지울 실체가 없어 삭제 버튼을 숨긴다. */
  isPlaceholder?: boolean
  /** FRT-145: 이 행에 사용자가 항목을 추가할 수 있는가(블록 층위 opt-in). */
  allowRowExtras?: boolean
  onCellChange: (colKey: string, value: CellValue) => void
  onExtrasChange: (next: (fields: RowExtraField[]) => RowExtraField[]) => void
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
            col.blockType === "checklist" ||
            // 기간은 월 입력 2개+체크박스, 파일은 카드라 반 칸에 눌리면 읽을 수 없다(FRT-213).
            col.blockType === "period" ||
            col.blockType === "file"

          return (
            <div key={col.key} className={`flex flex-col gap-1.5 ${isWide ? "sm:col-span-2" : ""}`}>
              <label className="text-caption text-text-secondary">
                {col.label}
                {col.required && <RequiredDot />}
              </label>
              {col.guide && index === 0 && (
                <p className="text-caption text-text-tertiary">{col.guide}</p>
              )}
              <CellInput
                column={col}
                value={cellVal}
                ariaLabel={col.label}
                onChange={(v) => onCellChange(col.key, v)}
              />
            </div>
          )
        })}
      </div>
      {allowRowExtras && (
        <RowExtraFieldsEditor fields={row.extraFields ?? []} onChange={onExtrasChange} />
      )}
    </div>
  )
}

/** FRT-145 '항목 추가'에서 고를 수 있는 유형. 선택지 없이도 성립하는 것만 연다 — `single-select`
 *  는 options 가 없으면 빈 드롭다운이고 `checklist` 는 `tags` 와 같은 자유입력으로 폴백한다.
 *  `file` 은 값이 구조화 객체라 `RowExtraField.value` 에 담기지 않아 계속 빠진다(FRT-213).
 *  옵션 편집 UI 도 아직 없다. */
const EXTRA_FIELD_TYPES: { value: RowExtraFieldType; label: string }[] = [
  { value: "text", label: "한 줄 텍스트" },
  { value: "textarea", label: "여러 줄 텍스트" },
  { value: "date", label: "날짜" },
  { value: "period", label: "기간" },
  { value: "link", label: "링크" },
  { value: "tags", label: "태그" },
]

/**
 * 행 하나에만 붙는 사용자 항목 편집기 (FRT-145).
 * 값 입력은 새 컴포넌트를 만들지 않고 컬럼 셀과 같은 `CellInput` 을 재사용한다 —
 * 같은 유형이 폼과 상세뷰에서 같은 모양으로 보여야 한다.
 */
function RowExtraFieldsEditor({
  fields,
  onChange,
}: {
  fields: RowExtraField[]
  onChange: (next: (fields: RowExtraField[]) => RowExtraField[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draftLabel, setDraftLabel] = useState("")
  const [draftType, setDraftType] = useState<RowExtraFieldType>("text")
  // 값이 있는 항목은 한 번 확인한 뒤에 지운다 — 되돌리는 경로가 없는 손실이라서다.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  // 이름 수정 직전의 값. 타이핑 중 빈 칸을 거치는 건 정상이라 막지 않고, 포커스가 떠날 때만 되돌린다.
  const labelBeforeEdit = useRef<Record<string, string>>({})

  function add() {
    const trimmed = draftLabel.trim()
    if (!trimmed) return
    onChange(prev => [
      ...prev,
      {
        key: uid("extra"),
        label: trimmed,
        blockType: draftType,
        value: draftType === "tags" ? [] : "",
      },
    ])
    setDraftLabel("")
    setDraftType("text")
    setAdding(false)
  }

  /**
   * 이름은 만들 때 비울 수 없다(`add` 가 막는다) — 고칠 때도 같은 규칙을 지킨다.
   * 비운 채 떠나면 직전 이름으로 되돌린다. 저장된 라벨은 백엔드 분석이 그대로 읽으므로
   * 이름 없는 항목이 남아선 안 되고, 그렇다고 값까지 딸려 지우면 손실이다(지우기는 삭제 버튼의 몫).
   */
  function commitLabel(field: RowExtraField) {
    const next = field.label.trim() || labelBeforeEdit.current[field.key] || field.label
    if (next === field.label) return
    onChange(prev => prev.map(f => (f.key === field.key ? { ...f, label: next } : f)))
  }

  function remove(key: string) {
    onChange(prev => prev.filter(f => f.key !== key))
    setPendingDelete(null)
  }

  return (
    <div className="mt-3 pt-3 border-t border-border flex flex-col gap-3">
      {fields.length > 0 && (
        <span className="text-caption text-text-tertiary font-medium">내가 추가한 항목</span>
      )}

      {fields.map(field => (
        <div key={field.key} className="flex flex-col gap-1.5">
          {/* 삭제 확인이 뜨면 모바일에서는 아래 줄로 내린다 — 한 줄에 두면 항목 이름이 몇 글자만
              남을 만큼 눌린다(프리뷰에서 확인). */}
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="text"
              aria-label="항목 이름"
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-caption text-text-secondary hover:border-border focus:border-brand focus:outline-none"
              value={field.label}
              onFocus={() => {
                const current = field.label.trim()
                if (current) labelBeforeEdit.current[field.key] = current
              }}
              onBlur={() => commitLabel(field)}
              onChange={e =>
                onChange(prev =>
                  prev.map(f => (f.key === field.key ? { ...f, label: e.target.value } : f)),
                )
              }
            />
            {pendingDelete === field.key ? (
              <span className="flex w-full shrink-0 items-center gap-1.5 text-caption text-text-tertiary sm:w-auto">
                내용도 함께 지워집니다
                <button
                  type="button"
                  onClick={() => remove(field.key)}
                  className="rounded px-1.5 py-0.5 text-error hover:bg-surface-tertiary transition-colors"
                >
                  지우기
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="rounded px-1.5 py-0.5 text-text-secondary hover:bg-surface-tertiary transition-colors"
                >
                  취소
                </button>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`${field.label || "이름 없는 항목"} 항목 삭제`}
                onClick={() =>
                  cellFilled(field.value) ? setPendingDelete(field.key) : remove(field.key)
                }
                className="shrink-0 rounded p-1 text-text-tertiary hover:text-error transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <CellInput
            column={{ key: field.key, label: field.label, blockType: field.blockType }}
            value={field.value}
            ariaLabel={field.label}
            onChange={v => {
              // `RowExtraFieldType` 에 'file' 이 없어 파일 셀 값은 여기로 오지 않는다(도달 불가).
              if (isFileCellValue(v)) return
              onChange(prev => prev.map(f => (f.key === field.key ? { ...f, value: v } : f)))
            }}
          />
        </div>
      ))}

      {adding ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="항목 유형"
            className="h-8 rounded-md border border-border bg-surface px-2 text-caption text-text-primary focus:border-brand focus:outline-none"
            value={draftType}
            onChange={e => setDraftType(e.target.value as RowExtraFieldType)}
          >
            {EXTRA_FIELD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            aria-label="추가할 항목 이름"
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-caption text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            placeholder="항목 이름..."
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          />
          <button
            type="button"
            onClick={add}
            className="h-8 shrink-0 rounded-md border border-border bg-surface px-2.5 text-caption text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            추가
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setDraftLabel("") }}
            className="h-8 shrink-0 rounded-md px-2 text-caption text-text-tertiary hover:bg-surface-tertiary transition-colors"
          >
            닫기
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAdding(true)}
          className="self-start"
        >
          <Plus size={14} className="mr-1" />
          항목 추가
        </Button>
      )}
    </div>
  )
}

/**
 * `CellInput` 이 렌더러를 가진 컬럼 유형. Record 로 두면 `blockType` 에 새 유형이 생길 때
 * 여기서도 빌드가 깨진다 — 편집칸만 만들고 조회 화면을 잊는 걸 막는다.
 */
const SUPPORTED_CELL_TYPES: Record<BlockColumnDef["blockType"], true> = {
  text: true,
  textarea: true,
  date: true,
  period: true,
  file: true,
  link: true,
  tags: true,
  checklist: true,
  "single-select": true,
}

/** 저장된 columns 가 템플릿보다 우선 채택되므로 타입에 없는 문자열이 런타임에 들어올 수 있다. */
function isSupportedCellType(blockType: string): blockType is BlockColumnDef["blockType"] {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_CELL_TYPES, blockType)
}

/**
 * 열 유형이 바뀌어 남은 옛 값. 감추면 사용자는 그 값을 덮어쓰는 줄도 모른 채 잃는다.
 * (파일 셀은 객체만 읽으므로 문자열 값이 화면에서 통째로 사라진다.)
 */
/** 컨트롤이 온전히 못 그리는 값과, 그대로 두면 무엇을 잃는지. 온전히 그리면 null. */
type HiddenCellValue = { text: string; note: string }

const DROPS_ALL = "값을 입력하면 이 값은 지워져요"
const DROPS_DAY = "값을 입력하면 날짜(일)는 지워져요"

/**
 * 컨트롤이 **화면에 그대로 못 그리는** 값을 돌려준다(온전히 그리면 null).
 *
 * 스칼라 입력은 자기 형식에 안 맞는 값을 조용히 버린다 — `type="month"`/`type="date"` 는
 * 브라우저가 값을 무효로 보고 빈 칸을 그리고, `select` 는 옵션에 없는 값을 고르지 못한다.
 * 셀에는 값이 그대로 남아 있는데 화면에는 없으니, 사용자는 그 위에 입력해 덮어쓰는 줄도 모른다.
 * 열 유형을 바꾸면(text·tags → period 등) 어느 방향으로든 생기는 상태다.
 *
 * 값이 아예 안 보이는 경우만 있는 게 아니다 — 기간 셀은 월 입력 2개뿐이라 일 단위 값을
 * 절삭해 **일부만** 그린다. 그 상태로 편집하면 날짜(일)가 조용히 사라지므로 같이 알린다.
 */
function hiddenCellValue(column: BlockColumnDef, text: string): HiddenCellValue | null {
  if (!text.trim()) return null
  switch (column.blockType) {
    case "period": {
      const parsed = parsePeriodString(text)
      // 셀은 월 입력 2개로 그리므로 일 단위 값은 절삭돼 보인다 — 월까지만 따진다.
      const readable = (token: string) => token === "" || isRealMonth(truncateToMonth(token))
      if (!readable(parsed.start) || !readable(parsed.end)) return { text, note: DROPS_ALL }
      // 파서는 `~` 앞뒤 두 토큰만 읽고 `현재` 는 어디에 있든 '현재'로 본다 — 뒤에 남은 말
      // ("… ~ 2024.02 ~ 메모" · "… ~ 현재까지")은 컨트롤에 실리지 않아 다음 편집에 사라진다.
      // 되짚어 원문과 같아야 온전히 읽은 것이다(공백은 직렬화가 정하므로 빼고 견준다).
      const compact = (s: string) => s.replace(/\s/g, "")
      const roundTrip = formatPeriodString(parsed)
      if (compact(roundTrip) !== compact(text)) return { text, note: DROPS_ALL }
      // 절삭된 채로 저장되는 건 다음 편집 때다. 그 전에 무엇이 사라질지 말해 준다.
      return hasDayPrecision(parsed.start) || hasDayPrecision(parsed.end)
        ? { text, note: DROPS_DAY }
        : null
    }
    case "date":
      return isRealDay(text) ? null : { text, note: DROPS_ALL }
    case "single-select":
      return (column.options ?? []).includes(text) ? null : { text, note: DROPS_ALL }
    default:
      return null
  }
}

function LegacyCellText({ text, note }: { text: string; note?: string }) {
  return (
    <p className="text-caption text-text-tertiary">
      이전 값: {text}
      {note ? ` — ${note}` : ""}
    </p>
  )
}

function CellInput({
  column,
  value,
  ariaLabel,
  onChange,
}: {
  column: BlockColumnDef
  value: CellValue | undefined
  /** 라벨이 `<label htmlFor>` 로 묶여 있지 않아 입력칸에 접근 가능한 이름이 없다 — 직접 준다. */
  ariaLabel?: string
  onChange: (value: CellValue) => void
}) {
  // 열 타입이 변경되어 기존 값(string ↔ string[])이 불일치할 때 UI에서 값이 사라지지 않도록 정규화한다.
  // 파일 셀 값(객체)도 `cellText` 가 파일명으로 접어 주므로 어떤 조합에서도 값을 잃지 않는다.
  const strVal = cellText(value)
  const arrVal = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
      : []

  // 열 유형을 바꾸면 컨트롤이 못 읽는 값이 셀에 남는다. 두 갈래가 있다 —
  //  (1) file 에서 바뀐 경우: 배열 갈래는 첨부 객체를 빈 배열로, 스칼라 갈래는 빈 칸으로 접는다.
  //  (2) 스칼라로 바뀐 경우: month/date 입력은 형식이 어긋난 값을, select 는 옵션에 없는 값을 버린다.
  // 어느 쪽이든 **값은 남았는데 화면에 없어** 그 위에 입력하면 조용히 덮어쓰인다.
  // 갈래마다 챙기면 하나씩 빠지므로 스위치 전체를 한 번에 감싼다.
  const hidden: HiddenCellValue | null =
    column.blockType !== "file" && isFileCellValue(value)
      ? { text: cellText(value), note: "값을 입력하면 이 첨부는 지워져요" }
      : hiddenCellValue(column, strVal)
  const withHiddenValue = (node: ReactNode) =>
    hidden ? (
      <div className="flex flex-col gap-1">
        {node}
        <LegacyCellText text={hidden.text} note={hidden.note} />
      </div>
    ) : (
      <>{node}</>
    )

  return withHiddenValue(renderControl())

  function renderControl() {

  switch (column.blockType) {
    case "file": {
      // 값이 객체라 위 문자열 정규화를 쓰지 않는다. 타입이 어긋난 값(옛 텍스트 열)은 빈 첨부로
      // 시작하되, 그 값을 감추지는 않는다 — 안 보이면 업로드로 덮어쓰는 줄도 모른다.
      const legacy = isFileCellValue(value) ? "" : strVal
      return (
        <div className="flex flex-col gap-1">
          <FileCellInput
            value={isFileCellValue(value) ? value : undefined}
            onChange={onChange}
            ariaLabel={ariaLabel}
          />
          {legacy && <LegacyCellText text={legacy} note="파일을 올리면 이 값은 지워져요" />}
        </div>
      )
    }

    case "period":
      return <PeriodCellInput value={strVal} onChange={onChange} ariaLabel={ariaLabel} />

    case "textarea":
      return (
        <textarea
          aria-label={ariaLabel}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none resize-none min-h-[64px]"
          placeholder={column.placeholder}
          value={strVal}
          onChange={e => onChange(e.target.value)}
        />
      )

    case "date":
      return (
        <input
          type="date"
          aria-label={ariaLabel}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          value={strVal}
          onChange={e => onChange(e.target.value)}
        />
      )

    case "link":
      return (
        <input
          type="url"
          aria-label={ariaLabel}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          placeholder={column.placeholder ?? "https://..."}
          value={strVal}
          onChange={e => onChange(e.target.value)}
        />
      )

    case "tags":
      return <TagsCellInput value={arrVal} onChange={onChange} placeholder={column.placeholder} ariaLabel={ariaLabel} />

    case "checklist": {
      // FRT-178: 역할 칩 컬럼은 옵션이 상수가 아니라 폼의 '역할 이력'에서 파생된다.
      // 자유 태그 입력으로 폴백하면 등록되지 않은 역할이 생겨 동기화가 성립하지 않는다.
      if (column.variant === "role-chip") {
        return <RoleChips value={arrVal} onChange={onChange} />
      }
      const options = column.options ?? []
      if (options.length === 0) {
        // Fallback: free-form checklist entries (treated as tags)
        return <TagsCellInput value={arrVal} onChange={onChange} placeholder={column.placeholder ?? "항목 입력 후 Enter"} ariaLabel={ariaLabel} />
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

    case "single-select": {
      const options = column.options ?? []
      return (
        <select
          aria-label={ariaLabel}
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

    case "text":
      return (
        <input
          type="text"
          aria-label={ariaLabel}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          placeholder={column.placeholder}
          value={strVal}
          onChange={e => onChange(e.target.value)}
        />
      )

    default: {
      // 컴파일 가드 — `BlockColumnDef.blockType` 에 새 유형이 생기면 여기서 빌드가 깨진다.
      // 예전처럼 조용히 텍스트칸이 되는 일이 없도록, 렌더러를 채우는 걸 잊을 수 없게 만든다.
      const unknownType: never = column.blockType
      // ⚠️ 컴파일 가드만으로는 부족하다. 저장된 값의 columns 가 템플릿보다 우선 채택되므로
      // (types/archive.ts 의 injectValue 주석) 타입에 없는 문자열이 런타임에 들어올 수 있다.
      // 값은 그대로 편집할 수 있게 두되, 무음으로 흡수하지 않고 화면에 드러낸다.
      console.warn(`CellInput: 알 수 없는 컬럼 유형 "${String(unknownType)}" — 텍스트 입력으로 대체합니다.`)
      return (
        <div className="flex flex-col gap-1">
          <p className="text-caption text-error">
            아직 지원하지 않는 입력 유형이에요. 입력한 값은 그대로 보관돼요.
          </p>
          <input
            type="text"
            aria-label={ariaLabel}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary focus:border-brand focus:outline-none"
            value={strVal}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      )
    }
    }
  }
}

/**
 * 기간 셀 (FRT-213). 값은 블록 층위 `PeriodBlock` 과 같은 **점 구분 문자열** 하나다
 * (`"2023.03 ~ 2024.01"` · `"2023.03 ~ 현재"`) — 셀은 `string | string[]` 만 담으므로
 * 객체를 쓸 수 없고, 이 형태가 상세뷰에 그대로 표시되는 최종 문구이기도 하다.
 *
 * `PeriodPicker` 를 감싸지 않는다 — 내부 `DatePicker` 가 `h-12` 라 표의 다른 셀(`h-9`)과 높이가
 * 어긋나고, 월/일 전환 라디오는 표 한 칸에 넣기엔 넓다. 셀은 원시 input 을 직접 쓰는 게
 * 이 파일의 기존 방식이다(`date` 셀도 `DatePicker` 를 쓰지 않는다). 확정본이 요구하는
 * month~month 만 다루고, 일 단위가 필요해지면 그때 granularity 를 연다.
 */
function PeriodCellInput({
  value,
  ariaLabel,
  onChange,
}: {
  value: string
  ariaLabel?: string
  onChange: (value: string) => void
}) {
  const parsed = parsePeriodString(value)
  // 일 단위로 저장된 값(다른 경로로 들어온 레거시)도 월 입력에 얹히도록 절삭한다.
  const start = truncateToMonth(parsed.start)
  const end = truncateToMonth(parsed.end)
  const isCurrent = parsed.isCurrent

  function commit(next: Partial<{ start: string; end: string; isCurrent: boolean }>) {
    const nextCurrent = next.isCurrent ?? isCurrent
    onChange(
      formatPeriodString({
        start: next.start ?? start,
        // '현재'는 종료일과 공존할 수 없다 — 켜는 순간 종료 값을 비운다.
        end: nextCurrent ? "" : (next.end ?? end),
        isCurrent: nextCurrent,
      }),
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="month"
        aria-label={ariaLabel ? `${ariaLabel} 시작` : "시작"}
        className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary focus:border-brand focus:outline-none"
        value={start}
        onChange={e => commit({ start: e.target.value })}
      />
      <span className="shrink-0 text-body-sm text-text-tertiary">~</span>
      <input
        type="month"
        aria-label={ariaLabel ? `${ariaLabel} 종료` : "종료"}
        className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary focus:border-brand focus:outline-none disabled:bg-surface-secondary disabled:text-text-disabled"
        value={isCurrent ? "" : end}
        disabled={isCurrent}
        onChange={e => commit({ end: e.target.value })}
      />
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-caption text-text-secondary">
        <input
          type="checkbox"
          checked={isCurrent}
          onChange={e => commit({ isCurrent: e.target.checked })}
          // 감싼 <label> 만으로는 어느 기간의 '현재'인지 알 수 없다 — 기간 컬럼이 둘 이상이면
          // 체크박스가 전부 똑같이 읽힌다. 시작·종료 입력과 같은 방식으로 컬럼 이름을 붙인다.
          aria-label={ariaLabel ? `${ariaLabel} 현재` : "현재"}
          className="rounded border-border text-brand focus:ring-brand"
        />
        현재
      </label>
    </div>
  )
}

function TagsCellInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  ariaLabel?: string
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
        aria-label={ariaLabel}
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
