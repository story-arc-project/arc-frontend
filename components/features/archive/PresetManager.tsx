"use client"

import { useState } from "react"
import { Star, Copy, Trash2, Pencil, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Preset } from "@/types/archive"

interface PresetManagerProps {
  presets: Preset[]
  onToggleFavorite: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export default function PresetManager({
  presets,
  onToggleFavorite,
  onRename,
  onDuplicate,
  onDelete,
}: PresetManagerProps) {
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const sorted = [...presets].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const filtered = search.trim()
    ? sorted.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : sorted

  function startRename(preset: Preset) {
    setEditingId(preset.id)
    setEditName(preset.name)
  }

  function commitRename() {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-title text-text-primary">내 프리셋</h3>
        <span className="text-caption text-text-tertiary">{presets.length}개</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          className="h-9 w-full rounded-md border border-border bg-surface-secondary pl-9 pr-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          placeholder="프리셋 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="flex flex-col gap-1">
        {filtered.length === 0 ? (
          <p className="text-body-sm text-text-tertiary text-center py-8">
            {search ? "검색 결과가 없습니다" : "저장된 프리셋이 없습니다"}
          </p>
        ) : (
          filtered.map(preset => (
            <div
              key={preset.id}
              className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-surface hover:border-border-strong transition-colors"
            >
              {/* Favorite toggle */}
              <button
                type="button"
                onClick={() => onToggleFavorite(preset.id)}
                className={[
                  "mt-0.5 shrink-0 transition-colors",
                  preset.isFavorite
                    ? "text-brand"
                    : "text-text-disabled hover:text-brand",
                ].join(" ")}
                aria-label={preset.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
              >
                <Star size={16} className={preset.isFavorite ? "fill-brand" : ""} />
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {editingId === preset.id ? (
                  <input
                    type="text"
                    className="w-full h-6 bg-transparent border-b border-brand text-body-sm text-text-primary focus:outline-none"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitRename()
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    autoFocus
                  />
                ) : (
                  <p className="text-body-sm text-text-primary truncate">{preset.name}</p>
                )}
                {preset.description && (
                  <p className="text-caption text-text-tertiary truncate mt-0.5">{preset.description}</p>
                )}
                <div className="flex gap-1 mt-1.5">
                  {preset.blocks.slice(0, 4).map(b => (
                    <Badge key={b.id} variant="default">{b.label}</Badge>
                  ))}
                  {preset.blocks.length > 4 && (
                    <span className="text-caption text-text-disabled">+{preset.blocks.length - 4}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => startRename(preset)}
                  className="p-1 text-text-tertiary hover:text-text-secondary rounded transition-colors"
                  aria-label="이름 변경"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(preset.id)}
                  className="p-1 text-text-tertiary hover:text-text-secondary rounded transition-colors"
                  aria-label="복제"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(preset.id)}
                  className="p-1 text-text-tertiary hover:text-error rounded transition-colors"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
