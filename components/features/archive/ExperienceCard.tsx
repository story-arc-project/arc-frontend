"use client"

import { MoreHorizontal, ChevronRight } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import type { ExperienceV2, Library } from "@/types/archive"
import { EXPERIENCE_TYPE_MAP } from "@/lib/templates-v2"

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
  const menuRef = useRef<HTMLDivElement>(null)
  const typeInfo = EXPERIENCE_TYPE_MAP[experience.typeId]

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

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
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
            className="text-text-tertiary hover:text-text-secondary transition-all p-1 rounded"
            aria-label="더보기"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-border rounded-lg shadow-md py-1 z-10">
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
                    type="button"
                    onClick={e => { e.stopPropagation(); setShowLibrarySubmenu(s => !s) }}
                    className="w-full flex items-center justify-between px-3 py-2 text-body-sm text-text-primary hover:bg-surface-secondary transition-colors"
                  >
                    라이브러리 이동
                    <ChevronRight size={14} className="text-text-tertiary" />
                  </button>
                  {showLibrarySubmenu && (
                    <div className="absolute left-full top-0 ml-1 w-36 bg-surface border border-border rounded-lg shadow-md py-1 z-20">
                      {libraries.filter(l => !l.isSystem).map(lib => {
                        const isIn = lib.experienceIds.includes(experience.id)
                        return (
                          <button
                            key={lib.id}
                            type="button"
                            onClick={e => { e.stopPropagation(); onMoveToLibrary(lib.id); setMenuOpen(false); setShowLibrarySubmenu(false) }}
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
                    </div>
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
            </div>
          )}
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
