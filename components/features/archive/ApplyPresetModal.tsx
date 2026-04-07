"use client"

import { useState } from "react"
import { Star, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import type { Preset } from "@/types/archive"

type ApplyMode = "insert" | "overwrite"

interface ApplyPresetModalProps {
  open: boolean
  presets: Preset[]
  onClose: () => void
  onApply: (presetId: string, mode: ApplyMode) => void
}

export default function ApplyPresetModal({ open, presets, onClose, onApply }: ApplyPresetModalProps) {
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applyMode, setApplyMode] = useState<ApplyMode>("insert")
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false)

  const sorted = [...presets].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const filtered = search.trim()
    ? sorted.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : sorted

  const selectedPreset = presets.find(p => p.id === selectedId)

  function handleApply() {
    if (!selectedId) return
    if (applyMode === "overwrite" && !showOverwriteWarning) {
      setShowOverwriteWarning(true)
      return
    }
    onApply(selectedId, applyMode)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="프리셋 적용">
      <div className="flex flex-col gap-4 min-h-[400px]">
        <div>
          <h3 className="text-heading-3 text-text-primary">프리셋 적용</h3>
          <p className="text-body-sm text-text-tertiary mt-1">
            저장된 프리셋을 선택해 확장 영역에 적용합니다.
          </p>
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

        {/* Preset list */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 border border-border rounded-lg p-2">
          {filtered.length === 0 ? (
            <p className="text-body-sm text-text-tertiary text-center py-8">프리셋이 없습니다</p>
          ) : (
            filtered.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => { setSelectedId(preset.id); setShowOverwriteWarning(false) }}
                className={[
                  "flex items-start gap-2 px-3 py-2.5 rounded-md text-left transition-colors w-full",
                  selectedId === preset.id
                    ? "bg-surface-brand border border-brand"
                    : "border border-transparent hover:bg-surface-secondary",
                ].join(" ")}
              >
                {preset.isFavorite && <Star size={14} className="text-brand mt-0.5 shrink-0 fill-brand" />}
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-text-primary truncate">{preset.name}</p>
                  {preset.description && (
                    <p className="text-caption text-text-tertiary truncate">{preset.description}</p>
                  )}
                  <div className="flex gap-1 mt-1">
                    {preset.blocks.slice(0, 3).map(b => (
                      <Badge key={b.id} variant="default">{b.type}</Badge>
                    ))}
                    {preset.blocks.length > 3 && (
                      <span className="text-caption text-text-disabled">+{preset.blocks.length - 3}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Preview */}
        {selectedPreset && (
          <div className="bg-surface-secondary rounded-lg p-3">
            <p className="text-caption text-text-tertiary mb-1">미리보기 — {selectedPreset.blocks.length}개 블록</p>
            <div className="flex flex-wrap gap-1">
              {selectedPreset.blocks.map(b => (
                <span key={b.id} className="text-body-sm text-text-secondary">
                  {b.label} ({b.type})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Apply mode */}
        <div className="flex gap-3">
          <label className={[
            "flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors text-body-sm",
            applyMode === "insert"
              ? "border-brand bg-surface-brand text-text-primary"
              : "border-border text-text-secondary hover:border-border-strong",
          ].join(" ")}>
            <input
              type="radio"
              name="applyMode"
              value="insert"
              checked={applyMode === "insert"}
              onChange={() => { setApplyMode("insert"); setShowOverwriteWarning(false) }}
              className="sr-only"
            />
            삽입 (추가)
          </label>
          <label className={[
            "flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors text-body-sm",
            applyMode === "overwrite"
              ? "border-brand bg-surface-brand text-text-primary"
              : "border-border text-text-secondary hover:border-border-strong",
          ].join(" ")}>
            <input
              type="radio"
              name="applyMode"
              value="overwrite"
              checked={applyMode === "overwrite"}
              onChange={() => { setApplyMode("overwrite"); setShowOverwriteWarning(false) }}
              className="sr-only"
            />
            덮어쓰기 (교체)
          </label>
        </div>

        {/* Overwrite warning */}
        {showOverwriteWarning && applyMode === "overwrite" && (
          <div className="bg-surface-error/10 border border-error/20 rounded-lg p-3">
            <p className="text-body-sm text-error">
              기존 확장 입력 블록이 모두 교체됩니다. 정말 적용할까요?
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={!selectedId}
          >
            {showOverwriteWarning ? "확인, 교체합니다" : "적용"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
