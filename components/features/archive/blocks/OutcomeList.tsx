"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { ArrowUpRight, Link2, Plus } from "lucide-react"
import type { Block, BlockRow, RepeatableCellBlockValue } from "@/types/archive"
import { createEmptyRow } from "@/lib/utils/block-utils"
import { useProjectLink } from "@/contexts/ProjectLinkContext"

interface OutcomeListProps {
  block: Block
  readOnly?: boolean
  onChange: (value: RepeatableCellBlockValue) => void
  /**
   * FRT-76 seam: 각 행 인풋과 삭제 버튼 사이에 붙는 액션(예: '+ 프로젝트로 기록').
   * 미지정 시 렌더하지 않는다. 각 행의 안정 `row.id` 로 참조 앵커를 만든다.
   */
  rowAction?: (row: BlockRow) => ReactNode
}

/**
 * 기본 한 줄, 내용이 길어지면 자동으로 높이가 늘어나는 textarea(스크롤 없음).
 * Enter 로 새 행을 추가하고 Shift+Enter 로 한 행 안에서 줄바꿈한다.
 */
function AutoGrowInput({
  value,
  placeholder,
  onChange,
  onKeyDown,
}: {
  value: string
  placeholder?: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      onKeyDown={onKeyDown}
      className="flex-1 resize-none overflow-hidden border-none bg-transparent py-0.5 text-body leading-6 text-text-primary placeholder:text-text-tertiary outline-none"
    />
  )
}

/**
 * 개조식 불릿-행 입력(FRT-97). 단일컬럼 `repeatable-cell`(key `'item'`) 위에서 동작한다 —
 * 타입/저장 스키마는 그대로 두고 렌더만 바꾸는 무마이그레이션 컴포넌트.
 * `• 텍스트(자동확장) + [액션] + [×]` 행, `+ 추가` 푸터.
 * Enter 로 다음 행, Shift+Enter 로 줄바꿈, 빈 행 Backspace 로 삭제.
 */
export default function OutcomeList({ block, readOnly, onChange, rowAction }: OutcomeListProps) {
  const val = block.value as RepeatableCellBlockValue
  const col = val.columns[0]
  const colKey = col?.key ?? "item"
  const rows = val.rows

  // FRT-76: linkConfig(템플릿 opt-in) + provider 둘 다 있을 때만 '프로젝트로 연결' 노출.
  const linkConfig = block.linkConfig
  const projectLink = useProjectLink()
  const linkEnabled = !!linkConfig && !!projectLink && !readOnly

  const listRef = useRef<HTMLDivElement>(null)
  // 다음 렌더에서 포커스할 행 id(예약). state 대신 ref 라 effect 안에서 setState 없이 정리한다.
  const pendingFocus = useRef<string | null>(null)

  // 행 추가/삭제로 rows 가 바뀐 뒤 예약된 인풋으로 포커스를 옮긴다(불릿 리스트 UX).
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    const el = listRef.current?.querySelector<HTMLTextAreaElement>(`[data-row-id="${id}"] textarea`)
    el?.focus()
    pendingFocus.current = null
  }, [rows])

  function textOf(row: BlockRow): string {
    const c = row.cells[colKey]
    return Array.isArray(c) ? c.join(", ") : (c ?? "")
  }

  function commit(nextRows: BlockRow[], focus?: string) {
    if (focus) pendingFocus.current = focus
    onChange({ ...val, rows: nextRows })
  }

  function updateText(rowId: string, text: string) {
    commit(rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colKey]: text } } : r)))
  }

  function addAfter(index: number) {
    const row = createEmptyRow(val.columns)
    commit([...rows.slice(0, index + 1), row, ...rows.slice(index + 1)], row.id)
  }

  function addAtEnd() {
    const row = createEmptyRow(val.columns)
    commit([...rows, row], row.id)
  }

  function removeRow(rowId: string) {
    // 마지막 행까지 지워 rows 가 [] 가 될 수 있게 둔다 — `isBlockEmpty`(rows.length===0)
    // 불변식을 지켜야 빈 블록이 상세뷰·포트폴리오에서 유령 섹션으로 남지 않는다.
    commit(rows.filter((r) => r.id !== rowId))
  }

  // FRT-76: 활동 행 → 프로젝트 행 생성 + 이 행에 참조 영속 + 그 프로젝트로 스크롤.
  function linkRow(row: BlockRow) {
    if (!linkConfig || !projectLink) return
    // 빈/공백 행은 제목 없는 프로젝트 행을 만들어버리므로 링크하지 않는다(버튼도 숨김).
    const text = textOf(row).trim()
    if (!text) return
    const newId = projectLink.createProjectRow(
      linkConfig.targetSectionId,
      linkConfig.titleColumnKey,
      text,
    )
    if (!newId) return
    commit(rows.map((r) => (r.id === row.id ? { ...r, linkedProjectRowId: newId } : r)))
    projectLink.scrollToProjectRow(newId)
  }

  // 참조만 해제(프로젝트 행은 존치) — soft link.
  function unlinkRow(rowId: string) {
    commit(
      rows.map((r) =>
        r.id === rowId && r.linkedProjectRowId !== undefined
          ? { id: r.id, cells: r.cells }
          : r,
      ),
    )
  }

  // 행 액션 슬롯. rowAction(테스트/스토리북 escape hatch)이 우선. 그다음 링크 UI.
  function renderRowAction(row: BlockRow): ReactNode {
    if (rowAction) return rowAction(row)
    if (!linkEnabled || !linkConfig || !projectLink) return null
    const linkedId = row.linkedProjectRowId
    // 대상 프로젝트가 실제로 존재할 때만 '연결됨'. 삭제됐으면(stale) 링크 버튼으로 복귀.
    const linked = linkedId ? projectLink.getProjectRow(linkConfig.targetSectionId, linkedId) : null
    // 빈/공백 행에서는 링크 버튼을 숨긴다 — 제목 없는 프로젝트 행 생성을 원천 차단.
    if (!linkedId && !textOf(row).trim()) return null
    if (linkedId && linked) {
      return (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface-brand pl-2 pr-1 py-0.5 text-caption font-medium text-brand-dark">
          <button
            type="button"
            onClick={() => projectLink.scrollToProjectRow(linkedId)}
            className="inline-flex items-center gap-0.5 hover:underline"
            title={linked.title || undefined}
          >
            연결됨
            <ArrowUpRight size={12} />
          </button>
          <button
            type="button"
            onClick={() => unlinkRow(row.id)}
            className="rounded-full p-0.5 leading-none text-brand-dark transition-colors hover:bg-brand-light"
            aria-label="프로젝트 연결 해제"
          >
            ×
          </button>
        </span>
      )
    }
    return (
      <button
        type="button"
        onClick={() => linkRow(row)}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-caption text-text-secondary transition-colors hover:border-brand hover:text-brand"
      >
        <Link2 size={12} />
        {linkConfig.label ?? "프로젝트로 연결"}
      </button>
    )
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, index: number, row: BlockRow) {
    // IME 조합 중의 Enter/Backspace 는 조합 확정용이므로 행 조작을 트리거하지 않는다(한글 입력).
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter" && !e.shiftKey) {
      // Enter = 다음 행. Shift+Enter 는 기본 동작(줄바꿈)을 허용해 한 행 안에서 여러 줄 입력.
      e.preventDefault()
      addAfter(index)
    } else if (e.key === "Backspace" && textOf(row) === "" && rows.length > 1) {
      e.preventDefault()
      const prev = rows[index - 1] ?? rows[index + 1]
      commit(
        rows.filter((r) => r.id !== row.id),
        prev?.id,
      )
    }
  }

  if (readOnly) {
    const filled = rows.filter((r) => textOf(r).trim())
    return (
      <div className="flex flex-col gap-3 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {filled.length === 0 ? (
          <p className="text-body text-text-disabled">—</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {filled.map((row) => (
              <li key={row.id} className="flex items-start gap-2 text-body-sm text-text-primary">
                <span className="text-brand font-bold leading-6 shrink-0 select-none">•</span>
                <span className="whitespace-pre-wrap">{textOf(row)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-label text-text-primary">{block.label}</span>
        <span className="text-caption text-text-tertiary">{rows.length}개 항목</span>
      </div>

      {block.guide && <p className="text-caption text-text-tertiary">{block.guide}</p>}

      <div ref={listRef} className="border border-border rounded-md overflow-hidden">
        {rows.map((row, index) => (
          <div
            key={row.id}
            data-row-id={row.id}
            className="flex items-start gap-2 border-b border-border px-3 py-2"
          >
            <span className="text-brand font-bold leading-6 shrink-0 select-none">•</span>
            <AutoGrowInput
              value={textOf(row)}
              placeholder={col?.placeholder}
              onChange={(e) => updateText(row.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index, row)}
            />
            {renderRowAction(row)}
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="shrink-0 rounded p-1 leading-6 text-text-tertiary transition-colors hover:text-error"
              aria-label={`${textOf(row).trim() || "항목"} 삭제`}
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addAtEnd}
          className="flex min-h-11 w-full items-center justify-center gap-1 text-body-sm text-text-secondary transition-colors hover:bg-surface-secondary sm:min-h-9"
        >
          <Plus size={16} />
          {col?.label ?? "활동 / 성과"} 추가
        </button>
      </div>
    </div>
  )
}
