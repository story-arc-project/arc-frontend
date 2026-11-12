"use client"

import { Search, X, SlidersHorizontal, BookmarkPlus } from "lucide-react"
import { useRef, useState } from "react"
import type { LibraryFilter, SortBy, ExperienceTypeId, ExperienceStatus } from "@/types/archive"
import { ALL_EXPERIENCE_TYPES, EXPERIENCE_TYPES, TYPE_CATEGORIES } from "@/lib/constants/templates-v2"
import { isImeComposing } from "@/lib/utils/keyboard"

interface FilterBarProps {
  filter: LibraryFilter
  isFilterActive: boolean
  onSearchChange: (search: string) => void
  onSortChange: (sortBy: SortBy) => void
  onToggleType: (typeId: ExperienceTypeId) => void
  onToggleStatus: (status: ExperienceStatus) => void
  onClearFilters: () => void
  onSaveAsLibrary?: (name: string) => void
  className?: string
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
  className,
}: FilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null)
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
    <div className={["flex flex-col gap-3", className ?? ""].join(" ")}>
      {/* Search + sort row */}
      <div className="flex gap-2">
        <div className="flex h-11 flex-1 min-w-0 items-center gap-2 rounded-md border border-border bg-surface-secondary pl-3 pr-1 focus-within:border-brand" data-archive-search>
          <Search size={16} aria-hidden="true" className="shrink-0 text-text-tertiary" />
          {((filter.typeIds?.length ?? 0) > 0 || (filter.statuses?.length ?? 0) > 0 || (filter.tags?.length ?? 0) > 0) && (
            <div role="group" aria-label="적용된 필터" className="flex min-w-0 max-w-[45%] shrink items-center gap-1 overflow-x-auto overscroll-x-contain whitespace-nowrap">
              {ALL_EXPERIENCE_TYPES.filter(type => filter.typeIds?.includes(type.id)).map(type => (
                <button
                  key={type.id}
                  type="button"
                  aria-label={`${type.label} 필터 해제`}
                  onClick={() => { onToggleType(type.id); searchRef.current?.focus() }}
                  className="flex shrink-0 items-center gap-1 rounded bg-surface-brand px-2 py-1 text-caption text-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2"
                >
                  {type.label}<X size={12} aria-hidden="true" />
                </button>
              ))}
              {filter.tags?.map((tag, index) => (
                <span key={`${tag}-${index}`} className="shrink-0 rounded bg-surface-brand px-2 py-1 text-caption text-brand">
                  태그: {tag}
                </span>
              ))}
              {(["draft", "complete"] as const).filter(status => filter.statuses?.includes(status)).map(status => {
                const label = status === "draft" ? "작성 중" : "완료"
                return (
                  <button
                    key={status}
                    type="button"
                    aria-label={`${label} 필터 해제`}
                    onClick={() => { onToggleStatus(status); searchRef.current?.focus() }}
                    className="flex shrink-0 items-center gap-1 rounded bg-surface-brand px-2 py-1 text-caption text-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2"
                  >
                    {label}<X size={12} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          )}
          <input
            ref={searchRef}
            type="text"
            className="h-full w-0 min-w-16 flex-1 bg-transparent text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            aria-label="경험 검색"
            placeholder="경험 검색..."
            value={filter.search ?? ""}
            onChange={e => onSearchChange(e.target.value)}
          />
          <div className="w-8 shrink-0">
            {filter.search && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => { onSearchChange(""); searchRef.current?.focus() }}
                className="flex h-9 w-8 items-center justify-center rounded text-text-tertiary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <select
          value={filter.sortBy ?? "updated"}
          onChange={e => onSortChange(e.target.value as SortBy)}
          className="h-11 rounded-md border border-border bg-surface-secondary px-3 text-body-sm text-text-primary focus:border-brand focus:outline-none"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowFilters(s => !s)}
          className={[
            "h-11 w-11 flex items-center justify-center rounded-md border transition-colors shrink-0",
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
                    onKeyDown={e => {
                      // 조합 중 Enter 는 확정용, Escape 는 조합 취소용이므로 저장/취소를 트리거하지 않는다.
                      if (isImeComposing(e)) return
                      if (e.key === "Enter") handleSave()
                      if (e.key === "Escape") setShowSaveInput(false)
                    }}
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
      aria-pressed={active}
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
