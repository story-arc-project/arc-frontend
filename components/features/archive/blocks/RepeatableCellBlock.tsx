"use client"

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { CornerUpLeft, ExternalLink, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RequiredDot } from "@/components/ui/required-dot"
import { useProjectLink } from "@/contexts/ProjectLinkContext"
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea"
import type {
  Block,
  RepeatableCellBlockValue,
  BlockRow,
  BlockColumnDef,
  CellValue,
  RowArtifact,
  RowExtraField,
  RowExtraFieldType,
} from "@/types/archive"
import {
  artifactFilled,
  cellFilled,
  cellText,
  createEmptyArtifact,
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
import { getSafeHref } from "@/lib/utils/url-utils"
import { capture } from "@/lib/analytics"
import FileCellInput from "./file/FileCellInput"
import RoleChips from "./RoleChips"
import { usePlaceholderRow } from "./usePlaceholderRow"
import { onEnterCommit } from "@/lib/utils/keyboard"

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

  // FRT-291: 행마다 결과물(링크·파일·설명)을 여러 건. 열이 아니라 행에 붙으므로 열 잠금과 무관하다.
  const allowRowArtifacts = block.allowRowArtifacts === true
  // FRT-143: 결과물 빈칸 문구는 유형이 정한다(템플릿 전용, 없으면 편집기 기본 문구).
  const artifactPlaceholders = block.artifactPlaceholders

  // FRT-210: 이 행이 형제 섹션의 개조식 리스트에서 연결돼 생겼는지(역방향 배지).
  // provider 밖(상세뷰·스토리북)에서는 null 이라 배지가 자동으로 숨는다 — 정방향 링크 UI 와 대칭.
  const projectLink = useProjectLink()

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

  /**
   * FRT-291: 행에 붙은 결과물만 갈아끼운다. `updateRowExtras` 와 같은 이유로 행을 다시 짜지
   * 않는다 — 그러면 그때 존재하는 다른 행 필드(linkedProjectRowId·roleTags·extraFields)가
   * 조용히 날아간다.
   */
  function updateRowArtifacts(rowId: string, next: (list: RowArtifact[]) => RowArtifact[]) {
    const patch = (row: BlockRow) => ({ artifacts: next(row.artifacts ?? []) })
    if (isPlaceholderRow(rowId)) {
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
                        ) : col.blockType === "link" && getSafeHref(display) ? (
                          // 링크 열은 글자로 접으면 보는 사람이 주소를 손으로 옮겨 적어야 한다 —
                          // 이 표가 대체한 `공개 링크`(LinkBlock)는 조회에서 실제 anchor 였다(FRT-267 Codex P2).
                          // 안전하지 않은 스킴은 아래 일반 텍스트 분기로 떨어져 글자로만 보인다.
                          <a
                            href={getSafeHref(display) as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-body-sm text-brand underline underline-offset-2 break-all hover:text-brand-dark"
                          >
                            <span className="break-all">{display}</span>
                            <ExternalLink size={13} className="shrink-0" aria-hidden />
                          </a>
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
                  {/* FRT-291: 이 행에 붙은 결과물. 값이 빈 첨부는 감춘다(위 항목과 같은 철학). */}
                  {(row.artifacts ?? []).filter(artifactFilled).map((a, ai) => (
                    <div key={a.id} className="flex flex-col gap-0.5">
                      <span className="text-caption text-text-tertiary font-medium">
                        결과물 {ai + 1}
                      </span>
                      {/* 열 수 없는 주소(스킴 없음·javascript: 등)는 anchor 로 만들지 않되 **글자로는
                          남긴다** — `artifactFilled` 이 채워진 것으로 세는 값이라, 안 그리면 화면엔
                          제목만 남아 사용자는 자기가 적은 주소를 잃은 것으로 읽는다. 같은 파일의
                          link 셀이 이미 쓰는 처리다(FRT-291 리뷰). */}
                      {a.url?.trim() ? (
                        getSafeHref(a.url) ? (
                          <a
                            href={getSafeHref(a.url) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-body-sm text-brand underline underline-offset-2 break-all hover:text-brand-dark"
                          >
                            <span className="break-all">{a.url}</span>
                            <ExternalLink size={13} className="shrink-0" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-body-sm text-text-primary break-all">{a.url}</span>
                        )
                      ) : null}
                      {a.file?.fileId?.trim() ? (
                        <FileCellInput value={a.file} readOnly ariaLabel={`결과물 ${ai + 1} 파일`} onChange={() => {}} />
                      ) : null}
                      {a.desc?.trim() ? (
                        <span className="text-body-sm text-text-primary whitespace-pre-wrap">{a.desc}</span>
                      ) : null}
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
              onKeyDown={onEnterCommit(addColumn)}
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
                  onKeyDown={onEnterCommit(addColumn)}
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
              allowRowArtifacts={allowRowArtifacts}
              artifactPlaceholders={artifactPlaceholders}
              incomingLink={projectLink?.getIncomingLink(row.id) ?? null}
              onCellChange={(colKey, cellVal) => updateCell(row.id, colKey, cellVal)}
              onExtrasChange={next => updateRowExtras(row.id, next)}
              onArtifactsChange={next => updateRowArtifacts(row.id, next)}
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
  allowRowArtifacts,
  artifactPlaceholders,
  incomingLink,
  onCellChange,
  onExtrasChange,
  onArtifactsChange,
  onRemove,
}: {
  row: BlockRow
  index: number
  columns: RepeatableCellBlockValue["columns"]
  /** FRT-103: 아직 value 에 커밋되지 않은 표시용 행. 지울 실체가 없어 삭제 버튼을 숨긴다. */
  isPlaceholder?: boolean
  /** FRT-145: 이 행에 사용자가 항목을 추가할 수 있는가(블록 층위 opt-in). */
  allowRowExtras?: boolean
  /** FRT-291: 이 행에 결과물을 여러 건 붙일 수 있는가(블록 층위 opt-in). */
  allowRowArtifacts?: boolean
  /** FRT-143: 결과물 빈칸 문구(유형별). */
  artifactPlaceholders?: Block["artifactPlaceholders"]
  /** FRT-210: 이 행을 만든 개조식 리스트가 있으면 그 블록 라벨. 없으면 null. */
  incomingLink?: { sourceLabel: string } | null
  onCellChange: (colKey: string, value: CellValue) => void
  onExtrasChange: (next: (fields: RowExtraField[]) => RowExtraField[]) => void
  onArtifactsChange?: (next: (list: RowArtifact[]) => RowArtifact[]) => void
  onRemove: () => void
}) {
  /**
   * 이 행 안에서 업로드가 하나라도 도는가 (FRT-291 리뷰).
   *
   * 결과물의 × 만 막는 것으로는 부족했다 — **행 전체를 지우는 버튼**이 바로 위에 있고, 그쪽으로
   * 지워도 `FileCellInput` 이 똑같이 언마운트돼 고른 파일이 사라진다. 셀의 `file` 열도 같은
   * 경로이므로 둘을 한 자리에서 센다.
   *
   * 핸들러는 키마다 **메모해서** 돌려준다. 인라인으로 만들면 `onBusyChange` 의 effect 가 렌더마다
   * 정리(false)→재실행(true)을 반복하고, 그 false 가 상태를 실제로 바꿔 다시 렌더를 부른다 —
   * 무한 루프가 된다.
   */
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set())
  // 신호를 보내는 칸의 목록을 **문자열로 굳혀** 메모 기준으로 쓴다. 배열째 의존하면 사용자가
  // 설명 한 글자만 고쳐도(= artifacts 배열이 새로 생겨도) 핸들러 신원이 바뀌어, 업로드 도중에
  // false→true 로 한 번 깜빡이는 창이 열린다. 목록이 실제로 달라질 때만 다시 만든다.
  const busySignature = [
    ...columns.filter(c => c.blockType === "file").map(c => `cell:${c.key}`),
    ...(row.artifacts ?? []).map(a => `artifact:${a.id}`),
  ].join("|")
  const busyHandlers = useMemo(() => {
    const map = new Map<string, (busy: boolean) => void>()
    for (const key of busySignature.split("|").filter(Boolean)) {
      map.set(key, (busy: boolean) =>
        setBusyKeys(prev => {
          if (prev.has(key) === busy) return prev
          const next = new Set(prev)
          if (busy) next.add(key)
          else next.delete(key)
          return next
        }),
      )
    }
    return map
  }, [busySignature])
  const busyHandler = (key: string) => busyHandlers.get(key)
  const uploading = busyKeys.size > 0

  return (
    // data-row-id: FRT-76 '프로젝트로 연결' 스크롤 앵커(전역 유일 row.id 로 scrollIntoView).
    <div data-row-id={row.id} className="scroll-mt-20 bg-surface-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-caption text-text-tertiary">#{index + 1}</span>
          {incomingLink && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-surface-brand px-2 py-0.5 text-caption font-medium text-brand-dark">
              <CornerUpLeft size={12} className="shrink-0" />
              <span className="truncate">{incomingLink.sourceLabel}에서 연결됨</span>
            </span>
          )}
        </div>
        {!isPlaceholder && (
          <button
            type="button"
            disabled={uploading}
            onClick={onRemove}
            className="text-text-tertiary hover:text-error transition-colors p-1 rounded disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-tertiary"
            aria-label="행 삭제"
            title={uploading ? "파일을 올리는 중이에요. 잠시 후 지울 수 있어요." : undefined}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {/* 한 필드당 한 행(FRT-315) — 반 칸에서는 placeholder·가이드라인·입력값이 잘린다. */}
      <div className="flex flex-col gap-3">
        {columns.map(col => {
          const cellVal = row.cells[col.key]
          return (
            <div key={col.key} className="flex flex-col gap-1.5">
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
                onBusyChange={busyHandler(`cell:${col.key}`)}
                onChange={(v) => onCellChange(col.key, v)}
              />
            </div>
          )
        })}
      </div>
      {allowRowExtras && (
        <RowExtraFieldsEditor fields={row.extraFields ?? []} onChange={onExtrasChange} />
      )}
      {allowRowArtifacts && onArtifactsChange && (
        <RowArtifactsEditor
          artifacts={row.artifacts ?? []}
          placeholders={artifactPlaceholders}
          onChange={onArtifactsChange}
          busyHandler={busyHandler}
        />
      )}
    </div>
  )
}

/**
 * 행 하나에 붙는 결과물 목록 (FRT-291). 확정본의 'artifact-blocks (파일 or 링크 + 설명)' 다중 등록.
 *
 * 표 셀이 아니라 행 아래 별도 묶음으로 그린다 — 열이 아니므로 다른 행의 모양을 바꾸지 않고,
 * 첨부가 없는 행은 버튼 한 줄만 차지한다(입력 허들 최소화).
 */
function RowArtifactsEditor({
  artifacts,
  placeholders,
  onChange,
  busyHandler,
}: {
  artifacts: RowArtifact[]
  /** FRT-143: 유형별 빈칸 문구. 없으면 카드의 기본 문구. */
  placeholders?: Block["artifactPlaceholders"]
  onChange: (next: (list: RowArtifact[]) => RowArtifact[]) => void
  /** 첨부별 업로드 신호를 행에 모아 주는 발급기 — 키마다 같은 함수를 돌려준다(RowEditor). */
  busyHandler: (key: string) => ((busy: boolean) => void) | undefined
}) {
  function patch(id: string, fields: Partial<RowArtifact>) {
    onChange(list => list.map(a => (a.id === id ? { ...a, ...fields } : a)))
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <span className="text-caption text-text-secondary font-medium">결과물</span>
      {artifacts.map((a, i) => (
        <ArtifactCard
          key={a.id}
          artifact={a}
          index={i}
          placeholders={placeholders}
          onBusyChange={busyHandler(`artifact:${a.id}`)}
          onPatch={fields => patch(a.id, fields)}
          onRemove={() => onChange(list => list.filter(x => x.id !== a.id))}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(list => [...list, createEmptyArtifact()])}
        className="self-start text-text-secondary"
      >
        <Plus size={14} className="mr-1" />
        결과물 추가
      </Button>
    </div>
  )
}

/**
 * 결과물 한 건의 카드.
 *
 * 목록이 아니라 **카드가** 컴포넌트인 이유는 상태 둘이 첨부마다 따로 살아야 해서다:
 * 삭제 확인(`pendingDelete`)과 업로드 진행 여부(`uploading`). 특히 후자는 `FileCellInput` 에
 * 넘기는 콜백이 **매 렌더 같은 함수여야** 한다 — 인라인 화살표를 주면 `onBusyChange` 의 effect 가
 * 렌더마다 정리(false)→재실행(true)을 반복해 상태가 진동한다. `useState` 의 setter 는 그 자체로
 * 안정적이라 이 구조가 가장 단순한 답이다.
 */
function ArtifactCard({
  artifact: a,
  index,
  placeholders,
  onBusyChange,
  onPatch,
  onRemove,
}: {
  artifact: RowArtifact
  index: number
  /** FRT-143: 유형별 빈칸 문구. 기본값은 프로젝트 확정본(FRT-291) 표기다. */
  placeholders?: Block["artifactPlaceholders"]
  /** 행에도 같은 신호를 흘린다 — 행 삭제 버튼이 이 카드 바깥에 있기 때문이다. */
  onBusyChange?: (busy: boolean) => void
  onPatch: (fields: Partial<RowArtifact>) => void
  onRemove: () => void
}) {
  // FRT-145 형제(RowExtraFieldsEditor)와 같은 이유로, 값이 든 결과물은 한 번 확인한 뒤에 지운다 —
  // 되돌리는 경로가 없는 손실이라서다.
  const [pendingDelete, setPendingDelete] = useState(false)
  // 업로드가 도는 동안 지우면 `FileCellInput` 이 언마운트되며 완료된 업로드가 버려진다 —
  // 그때 값(`fileId`)은 아직 비어 있어 위 확인 절차조차 지나가 버린다. 값으로는 알 수 없는
  // 상태라 신호로 받는다(`FileBlock`·`BlockList` 가 블록 층위에서 쓰는 것과 같은 처방).
  const [uploading, setUploading] = useState(false)
  // 두 곳이 같은 신호를 본다: 이 카드의 × 와 행 삭제 버튼. 한 콜백으로 묶어 두 소비처의
  // 기준이 갈리지 않게 하고, `useCallback` 으로 신원을 고정해 effect 진동을 막는다.
  const handleBusyChange = useCallback(
    (busy: boolean) => {
      setUploading(busy)
      onBusyChange?.(busy)
    },
    [onBusyChange],
  )

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-caption text-text-tertiary">결과물 #{index + 1}</span>
        {pendingDelete ? (
          <span className="flex items-center gap-1.5 text-caption text-text-tertiary">
            지워집니다
            {/* ×(진입)만 막으면 부족하다 — 확인 UI 가 떠 있는 동안에도 FileCellInput 은 렌더돼
                있어 업로드를 시작할 수 있고, 여기서 확정하면 같은 언마운트 경로로 유실된다. */}
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setPendingDelete(false)
                onRemove()
              }}
              className="rounded px-1.5 py-0.5 text-error hover:bg-surface-tertiary transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              title={uploading ? "파일을 올리는 중이에요. 잠시 후 지울 수 있어요." : undefined}
            >
              지우기
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(false)}
              className="rounded px-1.5 py-0.5 text-text-secondary hover:bg-surface-tertiary transition-colors"
            >
              취소
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => (artifactFilled(a) ? setPendingDelete(true) : onRemove())}
            className="text-text-tertiary hover:text-error transition-colors p-1 rounded disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-tertiary"
            aria-label={`결과물 ${index + 1} 삭제`}
            title={uploading ? "파일을 올리는 중이에요. 잠시 후 지울 수 있어요." : undefined}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {/* 원시 input 이 아니라 링크 셀을 쓴다 — 첨부 계측(FRT-113)이 여기에도 붙어야 한다.
          표의 link 셀과 파일 첨부는 이미 `archive_attachment_added` 를 쏘므로, 결과물 링크만
          빠지면 "프로젝트 결과물을 링크로 남긴다"는 가장 흔한 경로가 지표에서 사라진다. */}
      <LinkCellInput
        value={a.url ?? ""}
        placeholder={placeholders?.url ?? "Figma, Notion, GitHub 등"}
        ariaLabel={`결과물 ${index + 1} 링크`}
        onChange={v => onPatch({ url: v })}
      />
      <FileCellInput
        value={a.file}
        ariaLabel={`결과물 ${index + 1} 파일`}
        onBusyChange={handleBusyChange}
        onChange={v => onPatch({ file: v })}
      />
      <input
        type="text"
        value={a.desc ?? ""}
        onChange={e => onPatch({ desc: e.target.value })}
        placeholder={placeholders?.desc ?? "결과물 설명 (예: 와이어프레임, ERD, 테스트 결과서)"}
        aria-label={`결과물 ${index + 1} 설명`}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body-sm text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none"
      />
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
            onKeyDown={onEnterCommit(add)}
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
      // ⚠️ month 변형은 `<input type="month">` 라 일까지 붙은 값("2024-03-15")을 **통째로** 버린다
      // — `isRealDay` 로 판정하면 "온전히 읽음"으로 새어, 값이 화면에 없는데 안내도 없이 다음
      // 입력에 덮어쓰인다(FRT-269). 컨트롤을 좁힐 때 판정도 함께 좁혀야 하는 자리다.
      // 일부만 그리는 기간 셀과 달리 여기선 아무것도 안 남으므로 DROPS_DAY 가 아니라 DROPS_ALL 이다.
      return column.variant === "month"
        ? isRealMonth(text)
          ? null
          : { text, note: DROPS_ALL }
        : isRealDay(text)
          ? null
          : { text, note: DROPS_ALL }
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

/**
 * 여러 줄 텍스트 셀. 길게 쓰면 칸 안에서 스크롤하는 대신 칸이 내용만큼 자란다(노션 UI 피드백).
 *
 * `CellInput` 의 switch 안에서 훅을 부르면 조건부 호출이라 rules-of-hooks 에 걸리고,
 * `CellInput` 최상단으로 올리면 date·link·tags 등 이 기능이 필요 없는 모든 셀이 매 렌더
 * ref 와 layout effect 를 떠안는다. 이 셀 타입만 감싸는 컴포넌트가 양쪽을 다 피한다.
 */
function AutoGrowCellTextarea({
  value,
  placeholder,
  ariaLabel,
  onChange,
}: {
  value: string
  placeholder?: string
  ariaLabel?: string
  onChange: (value: CellValue) => void
}) {
  const ref = useAutoResizeTextarea(value)
  return (
    <textarea
      ref={ref}
      aria-label={ariaLabel}
      // `min-h-[64px]` 는 훅의 `height="auto"` 리셋과 무관하게 살아 있어 빈 칸의 최소 높이를 지킨다.
      // `overflow-hidden` 이 없으면 훅이 아직 재기 전인 찰나(하이드레이션 직후)에 스크롤바가 번쩍인다.
      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none resize-none overflow-hidden min-h-[64px]"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function CellInput({
  column,
  value,
  ariaLabel,
  onBusyChange,
  onChange,
}: {
  column: BlockColumnDef
  value: CellValue | undefined
  /** 라벨이 `<label htmlFor>` 로 묶여 있지 않아 입력칸에 접근 가능한 이름이 없다 — 직접 준다. */
  ariaLabel?: string
  /** `file` 열의 업로드 진행 여부를 행에 알린다 — 그동안 행 삭제를 막는다(FRT-291 리뷰). */
  onBusyChange?: (busy: boolean) => void
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
            onBusyChange={onBusyChange}
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
        <AutoGrowCellTextarea
          value={strVal}
          placeholder={column.placeholder}
          ariaLabel={ariaLabel}
          onChange={onChange}
        />
      )

    case "date":
      return (
        <input
          // 확정본이 month 로 정한 시점 컬럼은 일까지 묻지 않는다(FRT-269). 기본은 그대로 일 단위다.
          type={column.variant === "month" ? "month" : "date"}
          aria-label={ariaLabel}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          value={strVal}
          onChange={e => onChange(e.target.value)}
        />
      )

    case "link":
      return (
        <LinkCellInput
          value={strVal}
          onChange={onChange}
          placeholder={column.placeholder ?? "https://..."}
          ariaLabel={ariaLabel}
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
/**
 * 링크 셀 — 원시 input 과 다른 점은 **URL 첨부 계측(FRT-113)** 하나다.
 *
 * 이 표가 대체한 `공개 링크`(LinkBlock)는 blur 시점에 `archive_attachment_added` 를 쐈다.
 * 셀로 옮기며 그 발화가 빠지면 창작물의 URL 첨부만 지표에서 사라져, 파일 첨부는 세는데
 * 링크는 안 세는 비대칭이 된다(FRT-267 Codex P2). LinkBlock 과 **같은 세 가지 위양성 방어**를 쓴다:
 *  - `editedRef`: 실제로 타이핑했는가(기존 링크를 focus 만 하고 나가는 경우 제외)
 *  - `knownRef`: 이미 첨부로 아는 URL 집합(A→B→A 로 되돌아온 A 를 새 첨부로 세지 않는다)
 *  - 비교는 원문이 아니라 `getSafeHref` 정규화 결과로 — `https://a.dev` 와 `https://a.dev/` 는 같은 첨부다
 *
 * 셀 단위 컴포넌트라 ref 가 행·열마다 따로 산다 — 한 행의 링크를 고쳐도 다른 행의 기준선을
 * 건드리지 않는다.
 */
function LinkCellInput({
  value,
  placeholder,
  ariaLabel,
  onChange,
}: {
  value: string
  placeholder?: string
  ariaLabel?: string
  onChange: (value: string) => void
}) {
  const editedRef = useRef(false)
  const knownRef = useRef<Set<string>>(new Set())

  function handleChange(next: string) {
    if (!editedRef.current) {
      editedRef.current = true
      // 편집을 시작한 순간의 값이 "이미 있던 첨부"다. 빈 값·무효값이면 기준선이 없다.
      const baseline = getSafeHref(value)
      if (baseline) knownRef.current.add(baseline)
    }
    onChange(next)
  }

  function handleBlur() {
    if (!editedRef.current) return
    const safe = getSafeHref(value)
    if (!safe || knownRef.current.has(safe)) return
    knownRef.current.add(safe)
    // URL 원문은 싣지 않는다(PII·식별 위험) — 첨부 "여부"만 본다.
    capture("archive_attachment_added", { attachment_type: "url" })
  }

  return (
    <input
      type="url"
      aria-label={ariaLabel}
      className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
      placeholder={placeholder}
      value={value}
      onChange={e => handleChange(e.target.value)}
      onBlur={handleBlur}
    />
  )
}

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
        onKeyDown={onEnterCommit(add)}
        onBlur={add}
      />
    </div>
  )
}
