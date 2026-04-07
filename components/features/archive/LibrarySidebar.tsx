"use client"

import { useState } from "react"
import { Plus, FolderOpen, Trash2, Pencil, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Library, ExperienceV2 } from "@/types/archive"
import { matchesFilter } from "@/hooks/useLibraryFilter"

const LIBRARY_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
]

interface LibrarySidebarProps {
  libraries: Library[]
  activeLibraryId: string
  experiences: ExperienceV2[]
  onSelectLibrary: (id: string) => void
  onCreateLibrary: (name: string) => void
  onRenameLibrary: (id: string, name: string) => void
  onDeleteLibrary: (id: string) => void
  onUpdateLibraryColor: (id: string, color: string) => void
  onNewExperience: () => void
}

function countMatches(lib: Library, experiences: ExperienceV2[]): number {
  if (lib.isSystem) return experiences.length
  if (lib.filter) return experiences.filter(e => matchesFilter(e, lib.filter!)).length
  return lib.experienceIds.filter(id => experiences.some(e => e.id === id)).length
}

export default function LibrarySidebar({
  libraries,
  activeLibraryId,
  experiences,
  onSelectLibrary,
  onCreateLibrary,
  onRenameLibrary,
  onDeleteLibrary,
  onUpdateLibraryColor,
  onNewExperience,
}: LibrarySidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  function startRename(lib: Library) {
    setEditingId(lib.id)
    setEditName(lib.name)
  }

  function commitRename() {
    if (editingId && editName.trim()) {
      onRenameLibrary(editingId, editName.trim())
    }
    setEditingId(null)
  }

  function handleCreate() {
    const name = `라이브러리 ${libraries.filter(l => !l.isSystem).length + 1}`
    onCreateLibrary(name)
  }

  return (
    <aside className="w-full md:w-[20vw] md:min-w-[220px] md:max-w-[300px] md:fixed md:left-0 md:top-[var(--gnb-h)] md:bottom-0 flex flex-col border-r border-border bg-surface-secondary overflow-y-auto">
      {/* New experience button */}
      <div className="px-4 pt-4 pb-2">
        <Button variant="primary" size="sm" fullWidth onClick={onNewExperience}>
          <Plus size={16} className="mr-1" />
          새 경험 추가
        </Button>
      </div>

      {/* Library list */}
      <nav className="flex-1 px-2 py-2" aria-label="라이브러리">
        <p className="text-caption text-text-tertiary px-2 mb-1">라이브러리</p>
        <ul className="flex flex-col gap-0.5">
          {libraries.map(lib => {
            const count = countMatches(lib, experiences)
            const isActive = lib.id === activeLibraryId
            const isEditing = editingId === lib.id

            return (
              <li key={lib.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !isEditing && onSelectLibrary(lib.id)}
                  onKeyDown={e => { if (e.key === "Enter") onSelectLibrary(lib.id) }}
                  className={[
                    "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-body-sm min-w-0",
                    isActive
                      ? "bg-surface text-text-primary"
                      : "text-text-secondary hover:bg-surface hover:text-text-primary",
                  ].join(" ")}
                  aria-selected={isActive}
                >
                  {lib.isSystem ? (
                    <FolderOpen size={14} className="text-text-tertiary shrink-0" />
                  ) : lib.filter ? (
                    <SlidersHorizontal size={14} className="shrink-0" style={{ color: lib.color || "#6B7280" }} />
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setColorPickerId(colorPickerId === lib.id ? null : lib.id) }}
                        className="p-0.5 rounded hover:ring-2 hover:ring-border transition-all"
                        aria-label="색상 변경"
                      >
                        <span
                          className="block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: lib.color || "#6B7280" }}
                        />
                      </button>
                      {colorPickerId === lib.id && (
                        <div
                          className="absolute left-0 top-7 z-20 bg-surface border border-border rounded-lg shadow-md p-2 flex gap-1.5 flex-wrap w-[116px]"
                          onClick={e => e.stopPropagation()}
                        >
                          {LIBRARY_COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={e => { e.stopPropagation(); onUpdateLibraryColor(lib.id, c); setColorPickerId(null) }}
                              className={[
                                "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                                lib.color === c ? "border-text-primary scale-110" : "border-transparent",
                              ].join(" ")}
                              style={{ backgroundColor: c }}
                              aria-label={c}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isEditing ? (
                    <input
                      type="text"
                      className="flex-1 min-w-0 h-6 bg-transparent border-b border-brand text-body-sm text-text-primary focus:outline-none"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitRename()
                        if (e.key === "Escape") setEditingId(null)
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

        {/* Add library button */}
        <button
          type="button"
          onClick={handleCreate}
          className="flex items-center gap-2 px-3 py-2 mt-1 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors w-full rounded-md hover:bg-surface"
        >
          <Plus size={14} />
          라이브러리 추가
        </button>
      </nav>
    </aside>
  )
}
