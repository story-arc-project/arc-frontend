"use client"

import { formatDate } from "@/lib/utils/date-utils"
import { MoreHorizontal, ChevronRight } from "lucide-react"
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Badge } from "@/components/ui/badge"
import ImportanceSelector from "./ImportanceSelector"
import type { ExperienceV2, Library } from "@/types/archive"
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2"

interface ExperienceCardProps {
  experience: ExperienceV2
  selected: boolean
  libraries?: Library[]
  onClick: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveToLibrary?: (libraryId: string) => void
}


export default function ExperienceCard({
  experience,
  selected,
  libraries,
  onClick,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveToLibrary,
}: ExperienceCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showLibrarySubmenu, setShowLibrarySubmenu] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const submenuTriggerRef = useRef<HTMLButtonElement>(null)
  const typeInfo = EXPERIENCE_TYPE_MAP[experience.typeId]
  const memberLibraries = (libraries ?? []).filter(l => !l.isSystem && l.experienceIds.includes(experience.id))
  const manualLibraries = useMemo(
    () => (libraries ?? []).filter(l => !l.isSystem && !l.filter),
    [libraries],
  )

  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0 })

  // Measure the rendered portals before paint: content and viewport height may vary.
  useLayoutEffect(() => {
    if (!menuOpen) return
    const positionMenus = () => {
      const menu = menuRef.current
      const trigger = triggerRef.current
      if (!menu || !trigger) return
      const maxHeight = Math.max(0, window.innerHeight - 16)
      const maxWidth = Math.max(0, window.innerWidth - 16)
      menu.style.maxHeight = `${maxHeight}px`
      menu.style.maxWidth = `${maxWidth}px`
      const bounds = menu.getBoundingClientRect()
      const rect = trigger.getBoundingClientRect()
      const clamp = (value: number, size: number, limit: number) =>
        Math.max(8, Math.min(value, limit - size - 8))
      const preferredTop = rect.bottom + 4 + bounds.height <= window.innerHeight - 8
        ? rect.bottom + 4
        : rect.top - bounds.height - 4
      const top = clamp(preferredTop, bounds.height, window.innerHeight)
      const left = clamp(rect.right - bounds.width, bounds.width, window.innerWidth)
      // Place the parent before measuring the submenu trigger in its new position.
      menu.style.top = `${top}px`
      menu.style.left = `${left}px`
      setMenuPos({ top, left })

      const submenu = submenuRef.current
      const submenuTrigger = submenuTriggerRef.current
      if (!submenu || !submenuTrigger) return
      submenu.style.maxHeight = `${maxHeight}px`
      submenu.style.maxWidth = `${maxWidth}px`
      const submenuBounds = submenu.getBoundingClientRect()
      const anchor = submenuTrigger.getBoundingClientRect()
      const preferRight = anchor.right + submenuBounds.width + 4 <= window.innerWidth - 8
      setSubmenuPos({
        top: clamp(anchor.top, submenuBounds.height, window.innerHeight),
        left: clamp(preferRight ? anchor.right + 4 : anchor.left - submenuBounds.width - 4, submenuBounds.width, window.innerWidth),
      })
    }
    positionMenus()
    window.addEventListener("resize", positionMenus)
    const menu = menuRef.current
    // The body-portaled submenu must follow its row when the main menu scrolls.
    // Listen only on the parent scroll surface; submenu scrolling changes no anchor.
    menu?.addEventListener("scroll", positionMenus)
    return () => {
      window.removeEventListener("resize", positionMenus)
      menu?.removeEventListener("scroll", positionMenus)
    }
  }, [menuOpen, showLibrarySubmenu, manualLibraries.length])

  // A short grace period lets the pointer cross the gap between portal surfaces.
  const submenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepSubmenuOpen = () => {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current)
    setShowLibrarySubmenu(true)
  }
  const scheduleSubmenuClose = () => {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current)
    submenuCloseTimer.current = setTimeout(() => setShowLibrarySubmenu(false), 150)
  }
  useEffect(() => () => {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current)
  }, [])

  // Close menu on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    const inMenu = menuRef.current?.contains(target)
    const inTrigger = triggerRef.current?.contains(target)
    const inSubmenu = submenuRef.current?.contains(target)
    if (!inMenu && !inTrigger && !inSubmenu) {
      setMenuOpen(false)
      setShowLibrarySubmenu(false)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [menuOpen, handleOutsideClick])

  // Close menu on scroll
  useEffect(() => {
    if (!menuOpen) return
    const handleScroll = (e: Event) => {
      const target = e.target
      if (target instanceof Node && (menuRef.current?.contains(target) || submenuRef.current?.contains(target))) return
      setMenuOpen(false)
      setShowLibrarySubmenu(false)
    }
    window.addEventListener("scroll", handleScroll, true)
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [menuOpen])

  // Close menu on Escape so the topmost overlay is dismissed. The portals are
  // tagged `data-archive-popover` (below) so the archive preview's own Escape
  // handler yields to this menu instead of closing the docked preview.
  useEffect(() => {
    if (!menuOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuOpen(false); setShowLibrarySubmenu(false) }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [menuOpen])

  const contextMenu = menuOpen
    ? createPortal(
        <div
          ref={menuRef}
          data-archive-popover
          className="fixed w-40 bg-surface border border-border rounded-lg shadow-md py-1 z-50"
          style={{ top: menuPos.top, left: menuPos.left, overflowY: "auto", overscrollBehavior: "contain" }}
        >
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEdit(); setMenuOpen(false) }}
            className="w-full text-left px-3 py-2 text-body-sm text-text-primary hover:bg-surface-secondary transition-colors"
          >
            편집
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDuplicate(); setMenuOpen(false) }}
            className="w-full text-left px-3 py-2 text-body-sm text-text-primary hover:bg-surface-secondary transition-colors"
          >
            복제
          </button>
          {libraries && onMoveToLibrary && manualLibraries.length > 0 && (
            <div
              className="relative"
              onPointerEnter={e => { if (e.pointerType === "mouse") keepSubmenuOpen() }}
              onPointerLeave={e => { if (e.pointerType === "mouse") scheduleSubmenuClose() }}
            >
              <button
                ref={submenuTriggerRef}
                type="button"
                onClick={e => { e.stopPropagation(); setShowLibrarySubmenu(s => !s) }}
                className="w-full flex items-center justify-between px-3 py-2 text-body-sm text-text-primary hover:bg-surface-secondary transition-colors"
              >
                라이브러리 이동
                <ChevronRight size={14} className="text-text-tertiary" />
              </button>
              {showLibrarySubmenu &&
                createPortal(
                  <div
                    ref={submenuRef}
                    data-archive-popover
                    className="fixed w-36 bg-surface border border-border rounded-lg shadow-md py-1 z-50"
                    onPointerEnter={e => { if (e.pointerType === "mouse") keepSubmenuOpen() }}
                    onPointerLeave={e => { if (e.pointerType === "mouse") scheduleSubmenuClose() }}
                    style={{ top: submenuPos.top, left: submenuPos.left, overflowY: "auto", overscrollBehavior: "contain" }}
                  >
                    {manualLibraries.map(lib => {
                      const isIn = lib.experienceIds.includes(experience.id)
                      return (
                        <button
                          key={lib.id}
                          type="button"
                          onClick={e => { e.stopPropagation(); onMoveToLibrary(lib.id) }}
                          className={[
                            "w-full flex items-center gap-2 px-3 py-2 text-body-sm transition-colors",
                            isIn ? "text-brand bg-surface-brand/30" : "text-text-primary hover:bg-surface-secondary",
                          ].join(" ")}
                        >
                          {lib.color && (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: lib.color }} />
                          )}
                          <span className="truncate">{lib.name}</span>
                          {isIn && <span className="text-caption text-brand ml-auto">✓</span>}
                        </button>
                      )
                    })}
                  </div>,
                  document.body
                )}
            </div>
          )}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(); setMenuOpen(false) }}
            className="w-full text-left px-3 py-2 text-body-sm text-error hover:bg-surface-secondary transition-colors"
          >
            삭제
          </button>
        </div>,
        document.body
      )
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      // FRT-86: 키보드로 이웃 기록을 넘길 때 목록이 선택 카드를 따라가기 위한 스크롤 타깃.
      data-experience-id={experience.id}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={[
        "group relative bg-surface border rounded-lg p-4 cursor-pointer transition-colors",
        // FRT-86: 선택은 테두리·배경 틴트에 좌측 accent bar 를 더해 훑는 중에도 눈에 걸리게 한다.
        // 선택 상태에도 hover 반응(테두리 진해짐)을 남겨 "선택됨"과 "지금 가리키는 중"을 구분한다.
        selected
          ? "border-brand bg-surface-brand/30 hover:border-brand-dark " +
            "before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 " +
            "before:w-[3px] before:rounded-r-full before:bg-brand"
          : "border-border hover:border-border-strong",
      ].join(" ")}
    >
      {/* Top row: type badge + status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* 좁아지면 배지가 눌려 라벨이 음절 중간에서 갈린다 — 알약은 통째로 다음 줄로 넘긴다. */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <Badge variant="brand" className="whitespace-nowrap">
            {typeInfo?.label ?? "경험"}
          </Badge>
          <Badge
            variant={experience.status === "complete" ? "success" : "warning"}
            className="whitespace-nowrap"
          >
            {experience.status === "complete" ? "완료" : "작성 중"}
          </Badge>
          {experience.importance !== undefined && (
            <ImportanceSelector
              value={experience.importance}
              size="sm"
              readOnly
            />
          )}
        </div>

        {/* Quick actions */}
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
            className="text-text-tertiary hover:text-text-secondary transition-all p-1 rounded"
            aria-label="더보기"
          >
            <MoreHorizontal size={16} />
          </button>
          {contextMenu}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-title text-text-primary line-clamp-1 mb-1">
        {experience.title || "(제목 없음)"}
      </h3>

      {/* Summary */}
      {experience.summary && (
        <p className="text-body-sm text-text-secondary line-clamp-2 mb-2">
          {experience.summary}
        </p>
      )}

      {/* Library indicators */}
      {memberLibraries.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          {memberLibraries.map(lib => (
            <span
              key={lib.id}
              className="flex items-center gap-1 bg-surface-secondary rounded-full px-2 py-0.5"
            >
              <span
                className={["w-1.5 h-1.5 rounded-full shrink-0", lib.color ? "" : "bg-text-secondary"]
                  .filter(Boolean)
                  .join(" ")}
                style={lib.color ? { backgroundColor: lib.color } : undefined}
              />
              <span className="text-caption text-text-tertiary truncate max-w-[80px]">{lib.name}</span>
            </span>
          ))}
        </div>
      )}

      {/* Tags + date */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex flex-wrap gap-1 min-w-0 overflow-hidden">
          {experience.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="bg-surface-tertiary text-text-tertiary rounded-full px-2 py-0.5 text-caption truncate"
            >
              {tag}
            </span>
          ))}
          {experience.tags.length > 3 && (
            <span className="text-caption text-text-disabled">+{experience.tags.length - 3}</span>
          )}
        </div>
        <span className="text-caption text-text-disabled shrink-0">{formatDate(experience.updatedAt, "compact")}</span>
      </div>
    </div>
  )
}
