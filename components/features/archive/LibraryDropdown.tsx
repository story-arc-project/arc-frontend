"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, FolderOpen, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react"
import type { ExperienceV2, Library } from "@/types/archive"
import { matchesFilter } from "@/hooks/useLibraryFilter"
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper"

const LIBRARY_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
]

interface LibraryDropdownProps {
  libraries: Library[]
  activeLibraryId: string
  experiences: ExperienceV2[]
  onSelectLibrary: (id: string) => void
  onCreateLibrary: (name: string) => void
  onRenameLibrary: (id: string, name: string) => void
  onDeleteLibrary: (id: string) => void
  onUpdateLibraryColor: (id: string, color: string) => void
  className?: string
}

function countMatches(lib: Library, experiences: ExperienceV2[], expIds: Set<string>): number {
  if (lib.id === ALL_LIBRARY_ID) return experiences.length
  if (lib.filter) return experiences.filter(e => matchesFilter(e, lib.filter!)).length
  return lib.experienceIds.filter(id => expIds.has(id)).length
}

/**
 * 라이브러리 선택 + 인라인 관리(추가/이름변경/삭제/색상)를 한 드롭다운 팝오버에 담는다.
 * 구 `LibrarySidebar`(20vw 고정)를 대체하는 경량 컨트롤(FRT-75). 팝오버는 상단 toolbar 의
 * overflow 클리핑을 피하려고 body 로 portal + fixed positioning 한다(ExperienceCard 메뉴와 동일 패턴).
 */
export default function LibraryDropdown({
  libraries,
  activeLibraryId,
  experiences,
  onSelectLibrary,
  onCreateLibrary,
  onRenameLibrary,
  onDeleteLibrary,
  onUpdateLibraryColor,
  className,
}: LibraryDropdownProps) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [colorPickerPos, setColorPickerPos] = useState({ top: 0, left: 0 })
  const [pos, setPos] = useState({ top: 0, left: 0, width: 260 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  // Guards a single rename session against double-commit: Enter (or click-away)
  // commits, then the input's blur fires commitRename again with a stale
  // `editingId` closure; Escape must cancel without committing. The ref makes
  // the first finish win and the rest no-op until the next startRename.
  const renameHandledRef = useRef(false)

  const activeLibrary = libraries.find(l => l.id === activeLibraryId)
  const activeName = activeLibrary?.name ?? "전체"

  // Build the experience-id set once per experiences change so the per-row
  // manual-library membership count is O(|ids|) instead of O(|ids|×|exps|).
  const expIds = useMemo(() => new Set(experiences.map(e => e.id)), [experiences])

  const closeAll = useCallback(() => {
    setOpen(false)
    setEditingId(null)
    setColorPickerId(null)
  }, [])

  // Position the popover under the trigger when it opens.
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 260)
    setPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
    })
  }, [open])

  // Idempotent finish for one rename session — `commit` distinguishes
  // Enter/blur/outside-click (commit) from Escape (cancel). useCallback so
  // handleOutsideClick can depend on the *current* editing values.
  const finishRename = useCallback((commit: boolean) => {
    if (renameHandledRef.current) return
    renameHandledRef.current = true
    if (commit && editingId && editName.trim()) {
      onRenameLibrary(editingId, editName.trim())
    }
    setEditingId(null)
  }, [editingId, editName, onRenameLibrary])

  // Close on outside click — but commit any in-progress rename first so a
  // click-away saves the typed name (the input's blur can't be relied on to
  // fire before this handler tears the popover down).
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    if (
      popoverRef.current?.contains(target) ||
      triggerRef.current?.contains(target) ||
      colorPickerRef.current?.contains(target)
    ) return
    if (editingId) finishRename(true)
    closeAll()
  }, [closeAll, editingId, finishRename])

  useEffect(() => {
    if (!open) return
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [open, handleOutsideClick])

  // Close on page scroll / Escape. Scrolling *inside* the popover's own list
  // must not dismiss it, so the capture-phase handler ignores events whose
  // target lives within the popover.
  useEffect(() => {
    if (!open) return
    const onScroll = (e: Event) => {
      if (popoverRef.current?.contains(e.target as Node)) {
        // 리스트 내부 스크롤: 드롭다운은 유지하되, 포털로 떠 있는 색상 피커는 고정 좌표가
        // 행과 어긋나 엉뚱한 행 옆에 남으므로 닫는다(setState 는 idempotent).
        setColorPickerId(null)
        return
      }
      closeAll()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAll() }
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, closeAll])

  function startRename(lib: Library) {
    renameHandledRef.current = false
    setEditingId(lib.id)
    setEditName(lib.name)
    setColorPickerId(null)
  }

  function openColorPicker(lib: Library, anchor: HTMLElement) {
    if (colorPickerId === lib.id) { setColorPickerId(null); return }
    const r = anchor.getBoundingClientRect()
    const PICKER_W = 116
    setColorPickerPos({
      top: r.bottom + 4,
      left: Math.min(r.left, window.innerWidth - PICKER_W - 8),
    })
    setColorPickerId(lib.id)
  }

  function handleCreate() {
    const name = `라이브러리 ${libraries.filter(l => !l.isSystem).length + 1}`
    onCreateLibrary(name)
  }

  const popover = open
    ? createPortal(
        <div
          ref={popoverRef}
          data-archive-popover
          className="fixed z-50 bg-surface border border-border rounded-lg shadow-md py-2"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <p className="text-caption text-text-tertiary px-3 mb-1">라이브러리</p>
          <ul className="flex flex-col gap-0.5 px-1.5 max-h-[50vh] overflow-y-auto">
            {libraries.map(lib => {
              const count = countMatches(lib, experiences, expIds)
              const isActive = lib.id === activeLibraryId
              const isEditing = editingId === lib.id

              return (
                <li key={lib.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (!isEditing) { onSelectLibrary(lib.id); closeAll() } }}
                    onKeyDown={e => {
                      // 행의 중첩 컨트롤(색상/이름변경/삭제)에 포커스가 있을 때의 Enter/Space 는
                      // 그 버튼이 처리하도록 두고, 행 자체가 포커스됐을 때만 라이브러리를 선택한다.
                      if (e.target !== e.currentTarget) return
                      if ((e.key === "Enter" || e.key === " ") && !isEditing) {
                        e.preventDefault()
                        onSelectLibrary(lib.id)
                        closeAll()
                      }
                    }}
                    className={[
                      "group flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-body-sm min-w-0",
                      isActive
                        ? "bg-surface-brand/40 text-text-primary"
                        : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
                    ].join(" ")}
                    aria-pressed={isActive}
                  >
                    {lib.isSystem ? (
                      <FolderOpen size={14} className="text-text-tertiary shrink-0" />
                    ) : lib.filter ? (
                      <SlidersHorizontal size={14} className="shrink-0" style={{ color: lib.color || "#6B7280" }} />
                    ) : (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); openColorPicker(lib, e.currentTarget) }}
                        className="p-0.5 rounded hover:ring-2 hover:ring-border transition-all shrink-0"
                        aria-label="색상 변경"
                      >
                        <span
                          className="block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: lib.color || "#6B7280" }}
                        />
                      </button>
                    )}

                    {isEditing ? (
                      <input
                        type="text"
                        className="flex-1 min-w-0 h-6 bg-transparent border-b border-brand text-body-sm text-text-primary focus:outline-none"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={() => finishRename(true)}
                        onKeyDown={e => {
                          if (e.key === "Enter") finishRename(true)
                          if (e.key === "Escape") finishRename(false)
                        }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 truncate">{lib.name}</span>
                    )}

                    <span className="text-caption text-text-disabled">{count}</span>

                    {!lib.isSystem && !isEditing && (
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); startRename(lib) }}
                          className="p-0.5 text-text-tertiary hover:text-text-secondary rounded"
                          aria-label="이름 변경"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onDeleteLibrary(lib.id) }}
                          className="p-0.5 text-text-tertiary hover:text-error rounded"
                          aria-label="삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="px-1.5 pt-1 mt-1 border-t border-border">
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-2 px-2.5 py-2 text-body-sm text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors w-full rounded-md"
            >
              <Plus size={14} />
              라이브러리 추가
            </button>
          </div>
        </div>,
        document.body,
      )
    : null

  // Color picker is portaled (not nested in the scrollable list) so the swatch
  // grid for the bottom-most library isn't clipped by the list's overflow.
  const colorPickerLib = colorPickerId ? libraries.find(l => l.id === colorPickerId) : null
  const colorPicker = open && colorPickerLib
    ? createPortal(
        <div
          ref={colorPickerRef}
          data-archive-popover
          className="fixed z-[60] bg-surface border border-border rounded-lg shadow-md p-2 flex gap-1.5 flex-wrap w-[116px]"
          style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
        >
          {LIBRARY_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={e => { e.stopPropagation(); onUpdateLibraryColor(colorPickerLib.id, c); setColorPickerId(null) }}
              className={[
                "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                colorPickerLib.color === c ? "border-text-primary scale-110" : "border-transparent",
              ].join(" ")}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          "h-11 px-3 inline-flex items-center gap-1.5 rounded-md border bg-surface-secondary text-body-sm text-text-primary transition-colors min-w-0",
          open ? "border-brand" : "border-border hover:border-border-strong",
          className ?? "",
        ].join(" ")}
      >
        <FolderOpen size={15} className="text-text-tertiary shrink-0" />
        <span className="truncate font-medium">{activeName}</span>
        <ChevronDown size={15} className="text-text-tertiary shrink-0" />
      </button>
      {popover}
      {colorPicker}
    </>
  )
}
