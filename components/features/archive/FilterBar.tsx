"use client"

import { Search, X, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import type { LibraryFilter, SortBy, ExperienceTypeId, ExperienceStatus } from "@/types/archive"
import { EXPERIENCE_TYPES } from "@/lib/templates-v2"

interface FilterBarProps {
  filter: LibraryFilter
  isFilterActive: boolean
  onSearchChange: (search: string) => void
  onSortChange: (sortBy: SortBy) => void
  onToggleType: (typeId: ExperienceTypeId) => void
  onToggleStatus: (status: ExperienceStatus) => void
  onClearFilters: () => void
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
}: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false)

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
            "h-9 w-9 flex items-center justify-center rounded-md border transition-colors",
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
        <div className="flex flex-col gap-2">
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

          {/* Type filters */}
          <div className="flex flex-wrap gap-1.5">
            {EXPERIENCE_TYPES.map(t => (
              <FilterChip
                key={t.id}
                label={t.label}
                active={filter.typeIds?.includes(t.id) ?? false}
                onClick={() => onToggleType(t.id)}
              />
            ))}
          </div>

          {isFilterActive && (
            <button
              type="button"
              onClick={onClearFilters}
              className="flex items-center gap-1 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors self-start"
            >
              <X size={14} />
              필터 초기화
            </button>
          )}
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
