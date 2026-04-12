"use client"

import { MoreHorizontal, ChevronRight } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Badge } from "@/components/ui/badge"
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
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

  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0 })

  // Position the main menu when it opens
  useEffect(() => {
    if (!menuOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.min(rect.right - 160, window.innerWidth - 168),
    })
  }, [menuOpen])

  // Position submenu when it shows
  useEffect(() => {
    if (!showLibrarySubmenu || !submenuTriggerRef.current) return
    const rect = submenuTriggerRef.current.getBoundingClientRect()
    const submenuWidth = 144
    // Prefer right side, fall back to left if not enough space
    const preferRight = rect.right + submenuWidth + 4 <= window.innerWidth
    setSubmenuPos({
      top: rect.top,
      left: preferRight ? rect.right + 4 : rect.left - submenuWidth - 4,
    })
  }, [showLibrarySubmenu])

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
    const handleScroll = () => { setMenuOpen(false); setShowLibrarySubmenu(false) }
    window.addEventListener("scroll", handleScroll, true)
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [menuOpen])

  const contextMenu = menuOpen
    ? createPortal(
        <div
          ref={menuRef}
          className="fixed w-40 bg-surface border border-border rounded-lg shadow-md py-1 z-50"
          style={{ top: menuPos.top, left: menuPos.left }}
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
          {libraries && onMoveToLibrary && (
            <div
              className="relative"
              onMouseEnter={() => setShowLibrarySubmenu(true)}
              onMouseLeave={() => setShowLibrarySubmenu(false)}
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
                    className="fixed w-36 bg-surface border border-border rounded-lg shadow-md py-1 z-50"
                    style={{ top: submenuPos.top, left: submenuPos.left }}
                  >
                    {libraries.filter(l => !l.isSystem).map(lib => {
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
      aria-selected={selected}
      onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onClick() }}
      className={[
        "group relative bg-surface border rounded-lg p-4 cursor-pointer transition-colors",
        selected
          ? "border-brand bg-surface-brand/30"
          : "border-border hover:border-border-strong",
      ].join(" ")}
    >
      {/* Top row: type badge + status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="brand">{typeInfo?.label ?? "경험"}</Badge>
          <Badge variant={experience.status === "complete" ? "success" : "warning"}>
            {experience.status === "complete" ? "완료" : "작성 중"}
          </Badge>
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
      {libraries && libraries.filter(l => !l.isSystem && l.experienceIds.includes(experience.id)).length > 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          {libraries.filter(l => !l.isSystem && l.experienceIds.includes(experience.id)).map(lib => (
            <span
              key={lib.id}
              className="flex items-center gap-1 bg-surface-secondary rounded-full px-2 py-0.5"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: lib.color || "#6B7280" }}
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
        <span className="text-caption text-text-disabled shrink-0">{formatDate(experience.updatedAt)}</span>
      </div>
    </div>
  )
}
