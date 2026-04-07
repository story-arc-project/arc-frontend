"use client"

import { Search, X, SlidersHorizontal, BookmarkPlus } from "lucide-react"
import { useState } from "react"
import type { LibraryFilter, SortBy, ExperienceTypeId, ExperienceStatus } from "@/types/archive"
import { EXPERIENCE_TYPES, TYPE_CATEGORIES } from "@/lib/templates-v2"

interface FilterBarProps {
  filter: LibraryFilter
  isFilterActive: boolean
  onSearchChange: (search: string) => void
  onSortChange: (sortBy: SortBy) => void
  onToggleType: (typeId: ExperienceTypeId) => void
  onToggleStatus: (status: ExperienceStatus) => void
  onClearFilters: () => void
  onSaveAsLibrary?: (name: string) => void
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "updated", label: "최근 수정" },
  { value: "period", label: "기간순" },
  { value: "completion", label: "완료도" },
]

export default function FilterBar({
  filter,
  isFilterActive,
  onSearchChange,
  onSortChange,
  onToggleType,
  onToggleStatus,
  onClearFilters,
  onSaveAsLibrary,
}: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveName, setSaveName] = useState("")

  function handleSave() {
    const name = saveName.trim()
    if (!name || !onSaveAsLibrary) return
    onSaveAsLibrary(name)
    setSaveName("")
    setShowSaveInput(false)
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-surface">
      {/* Search + sort row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            className="h-9 w-full rounded-md border border-border bg-surface-secondary pl-9 pr-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            placeholder="경험 검색..."
            value={filter.search ?? ""}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <select
          value={filter.sortBy ?? "updated"}
          onChange={e => onSortChange(e.target.value as SortBy)}
          className="h-9 rounded-md border border-border bg-surface-secondary px-3 text-body-sm text-text-primary focus:border-brand focus:outline-none"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowFilters(s => !s)}
          className={[
            "h-9 w-9 flex items-center justify-center rounded-md border transition-colors shrink-0",
            showFilters || isFilterActive
              ? "border-brand bg-surface-brand text-brand"
              : "border-border bg-surface-secondary text-text-tertiary hover:text-text-secondary",
          ].join(" ")}
          aria-label="필터"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-col gap-3">
          {/* Status filters */}
          <div className="flex gap-2">
            <FilterChip
              label="작성 중"
              active={filter.statuses?.includes("draft") ?? false}
              onClick={() => onToggleStatus("draft")}
            />
            <FilterChip
              label="완료"
              active={filter.statuses?.includes("complete") ?? false}
              onClick={() => onToggleStatus("complete")}
            />
          </div>

          {/* Type filters grouped by category */}
          <div className="flex flex-col gap-2">
            {TYPE_CATEGORIES.map(cat => {
              const types = EXPERIENCE_TYPES.filter(t => t.category === cat.key)
              return (
                <div key={cat.key}>
                  <p className="text-caption text-text-tertiary mb-1">{cat.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map(t => (
                      <FilterChip
                        key={t.id}
                        label={t.label}
                        active={filter.typeIds?.includes(t.id) ?? false}
                        onClick={() => onToggleType(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between">
            {isFilterActive && (
              <button
                type="button"
                onClick={onClearFilters}
                className="flex items-center gap-1 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <X size={14} />
                필터 초기화
              </button>
            )}

            {/* Save as library */}
            {isFilterActive && onSaveAsLibrary && (
              showSaveInput ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveInput(false) }}
                    placeholder="라이브러리 이름"
                    className="h-7 w-24 rounded-md border border-border bg-surface-secondary px-2 text-caption text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    className="text-caption text-brand hover:text-brand-dark transition-colors"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSaveInput(false); setSaveName("") }}
                    className="text-caption text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveInput(true)}
                  className="flex items-center gap-1 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <BookmarkPlus size={14} />
                  라이브러리로 저장
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-2.5 py-1 text-caption transition-colors",
        active
          ? "bg-brand text-text-on-brand"
          : "bg-surface-tertiary text-text-secondary hover:bg-surface-secondary",
      ].join(" ")}
    >
      {label}
    </button>
  )
}
