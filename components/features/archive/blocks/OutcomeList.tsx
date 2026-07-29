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
import RoleChips from "./RoleChips"
import { usePlaceholderRow } from "./usePlaceholderRow"

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

  // FRT-103: rows 가 비면 표시용 행 하나를 파생한다(value 에는 커밋되지 않음).
  // 아래 길이 가드·항목 수는 계속 진짜 `rows` 를 본다.
  const { displayRows, hasPlaceholder, isPlaceholderRow, materialize } = usePlaceholderRow(
    rows,
    val.columns,
  )

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
    if (isPlaceholderRow(rowId)) {
      // FRT-103: 실제로 값이 채워질 때만 실체화한다. 같은 id 로 커밋하므로 렌더 key 가 그대로라
      // 리마운트가 없다(포커스·한글 IME 조합 보존) → 포커스 예약도 필요 없다.
      const row = materialize(rowId, colKey, text)
      if (row) commit([row])
      return
    }
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
    // 마지막 행까지 지워 rows 가 [] 가 될 수 있게 둔다. FRT-122 이후 `isBlockEmpty` 는
    // 빈 셀 행도 empty 로 보므로 유령 섹션은 판정 층위에서 이미 막히지만, 실제 값이 없는 행을
    // 굳이 남길 이유가 없어 그대로 제거한다.
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
  // ⚠️ 지울 건 `linkedProjectRowId` 하나다. `{ id, cells }` 로 다시 짜면 그때 존재하는
  // 다른 행 필드(roleTags 등)까지 통째로 날아간다 — 필드가 늘 때마다 조용히 깨지는 형태였다.
  function unlinkRow(rowId: string) {
    commit(
      rows.map((r) => {
        if (r.id !== rowId || r.linkedProjectRowId === undefined) return r
        const next = { ...r }
        delete next.linkedProjectRowId
        return next
      }),
    )
  }

  // FRT-178: 이 행에 붙은 역할 태그. 행 필드라 컬럼(단일컬럼 전제)에 영향이 없다.
  function updateRoles(rowId: string, next: string[]) {
    commit(rows.map((r) => (r.id === rowId ? { ...r, roleTags: next } : r)))
  }

  // 행 액션 슬롯. rowAction(테스트/스토리북 escape hatch)이 우선. 그다음 링크 UI.
  function renderRowAction(row: BlockRow): ReactNode {
    // FRT-103: 아직 실체가 없는 표시용 행에는 연결할 대상이 없다.
    if (isPlaceholderRow(row.id)) return null
    if (rowAction) return rowAction(row)
    if (!linkEnabled || !linkConfig || !projectLink) return null
    const linkedId = row.linkedProjectRowId
    // 대상 프로젝트가 실제로 존재할 때만 '연결됨'. 삭제됐으면(stale) 링크 버튼으로 복귀.
    const linked = linkedId
      ? projectLink.getProjectRow(linkConfig.targetSectionId, linkConfig.titleColumnKey, linkedId)
      : null
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
    // FRT-103: 표시용 행에서의 Enter 는 막는다. 그냥 두면 addAfter 가 진짜 rows(빈 배열) 위에서
    // 돌아 placeholder 와 **다른 id** 의 빈 행을 커밋한다 → 리마운트 + 누른 적 없는 둘째 줄.
    // Backspace 는 아래 `rows.length > 1` 가드가 진짜 rows(0)를 보므로 자동으로 막힌다.
    if (isPlaceholderRow(row.id)) {
      if (e.key === "Enter" && !e.shiftKey) e.preventDefault()
      return
    }
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
                {block.roleTags && (
                  <RoleChips readOnly value={row.roleTags ?? []} onChange={() => {}} />
                )}
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
        <span className="text-field-label text-text-primary">{block.label}</span>
        <span className="text-caption text-text-tertiary">{rows.length}개 항목</span>
      </div>

      {block.guide && <p className="text-caption text-text-tertiary">{block.guide}</p>}

      {/* overflow-hidden 은 둥근 모서리 밖으로 새는 자식 배경을 자르지만, 역할 칩 드롭다운까지
          잘라 등록된 역할이 반쯤 가려진다. 칩을 쓰는 블록만 열어두고 아래 '추가' 버튼에
          rounded-b-md 를 줘서 hover 배경이 모서리를 넘지 않게 한다. */}
      <div
        ref={listRef}
        className={`border border-border rounded-md ${block.roleTags ? "" : "overflow-hidden"}`}
      >
        {displayRows.map((row, index) => (
          <div
            key={row.id}
            data-row-id={row.id}
            // border-b 는 아래에 다음 행이나 '추가' 버튼이 올 때만 구분선이다. 표시용 행 하나만
            // 있는 빈 상태에서는 컨테이너 하단 테두리와 맞닿아 두 줄로 보이므로 뺀다.
            className={`flex items-start gap-2 px-3 py-2 ${hasPlaceholder ? "" : "border-b border-border"}`}
          >
            <span className="text-brand font-bold leading-6 shrink-0 select-none">•</span>
            {/* FRT-178: 선택한 역할은 문서대로 텍스트 앞에 뱃지로 붙는다. 아직 실체가 없는
                표시용 행에는 태그를 붙일 대상이 없어(커밋 경로가 텍스트 전용) 노출하지 않는다. */}
            {block.roleTags && !isPlaceholderRow(row.id) && (
              <RoleChips
                inline
                value={row.roleTags ?? []}
                onChange={(next) => updateRoles(row.id, next)}
              />
            )}
            <AutoGrowInput
              value={textOf(row)}
              placeholder={col?.placeholder}
              onChange={(e) => updateText(row.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index, row)}
            />
            {renderRowAction(row)}
            {/* FRT-103: 표시용 행에는 지울 실체가 없다(누르면 no-op 인 죽은 버튼이 된다). */}
            {!isPlaceholderRow(row.id) && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="shrink-0 rounded p-1 leading-6 text-text-tertiary transition-colors hover:text-error"
                aria-label={`${textOf(row).trim() || "항목"} 삭제`}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* FRT-103: 표시용 빈 줄이 있을 때만 '추가' 를 숨긴다(눌러도 화면이 그대로라 고장으로 읽힌다).
            `rows.length === 0` 로 판정하면 컬럼이 없어 빈 줄조차 못 그리는 블록에서 입력 수단이 사라진다. */}
        {!hasPlaceholder && (
          <button
            type="button"
            onClick={addAtEnd}
            className="flex min-h-11 w-full items-center justify-center gap-1 rounded-b-md text-body-sm text-text-secondary transition-colors hover:bg-surface-secondary sm:min-h-9"
          >
            <Plus size={16} />
            {col?.label ?? "활동 / 성과"} 추가
          </button>
        )}
      </div>
    </div>
  )
}
