"use client"

import { useState } from "react"
import { Plus, FolderOpen, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Library, ExperienceV2 } from "@/types/archive"

interface LibrarySidebarProps {
  libraries: Library[]
  activeLibraryId: string
  experiences: ExperienceV2[]
  onSelectLibrary: (id: string) => void
  onCreateLibrary: (name: string) => void
  onRenameLibrary: (id: string, name: string) => void
  onDeleteLibrary: (id: string) => void
  onNewExperience: () => void
}

function countMatches(lib: Library, experiences: ExperienceV2[]): number {
  if (lib.isSystem) return experiences.length
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
  onNewExperience,
}: LibrarySidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

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
                    "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-body-sm",
                    isActive
                      ? "bg-surface text-text-primary"
                      : "text-text-secondary hover:bg-surface hover:text-text-primary",
                  ].join(" ")}
                  aria-selected={isActive}
                >
                  {lib.color ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: lib.color }}
                    />
                  ) : (
                    <FolderOpen size={14} className="text-text-tertiary shrink-0" />
                  )}

                  {isEditing ? (
                    <input
                      type="text"
                      className="flex-1 h-6 bg-transparent border-b border-brand text-body-sm text-text-primary focus:outline-none"
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
