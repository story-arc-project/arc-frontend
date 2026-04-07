"use client"

import { useState, useMemo, useCallback } from "react"
import type {
  ExperienceV2,
  LibraryFilter,
  ExperienceTypeId,
  ExperienceStatus,
  SortBy,
} from "@/types/archive"

interface UseLibraryFilterReturn {
  filter: LibraryFilter
  setSearch: (search: string) => void
  setSortBy: (sortBy: SortBy) => void
  toggleTypeFilter: (typeId: ExperienceTypeId) => void
  toggleStatusFilter: (status: ExperienceStatus) => void
  toggleTagFilter: (tag: string) => void
  clearFilters: () => void
  filteredExperiences: ExperienceV2[]
  isFilterActive: boolean
}

function matchesFilter(exp: ExperienceV2, filter: LibraryFilter): boolean {
  if (filter.search) {
    const q = filter.search.toLowerCase()
    const inTitle = exp.title.toLowerCase().includes(q)
    const inSummary = exp.summary.toLowerCase().includes(q)
    const inTags = exp.tags.some(t => t.toLowerCase().includes(q))
    if (!inTitle && !inSummary && !inTags) return false
  }
  if (filter.typeIds && filter.typeIds.length > 0) {
    if (!filter.typeIds.includes(exp.typeId)) return false
  }
  if (filter.statuses && filter.statuses.length > 0) {
    if (!filter.statuses.includes(exp.status)) return false
  }
  if (filter.tags && filter.tags.length > 0) {
    if (!filter.tags.some(t => exp.tags.includes(t))) return false
  }
  return true
}

function sortExperiences(experiences: ExperienceV2[], sortBy: SortBy): ExperienceV2[] {
  const sorted = [...experiences]
  switch (sortBy) {
    case "updated":
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      break
    case "period":
      sorted.sort((a, b) => {
        const aStart = a.coreBlocks.find(bl => bl.label === "기간")
        const bStart = b.coreBlocks.find(bl => bl.label === "기간")
        const aVal = aStart?.value.type === "period" ? aStart.value.start : ""
        const bVal = bStart?.value.type === "period" ? bStart.value.start : ""
        return bVal.localeCompare(aVal)
      })
      break
    case "completion":
      sorted.sort((a, b) => {
        if (a.status === b.status) return 0
        return a.status === "complete" ? -1 : 1
      })
      break
  }
  return sorted
}

export function useLibraryFilter(experiences: ExperienceV2[]): UseLibraryFilterReturn {
  const [filter, setFilter] = useState<LibraryFilter>({ sortBy: "updated" })

  const setSearch = useCallback((search: string) => {
    setFilter(prev => ({ ...prev, search: search || undefined }))
  }, [])

  const setSortBy = useCallback((sortBy: SortBy) => {
    setFilter(prev => ({ ...prev, sortBy }))
  }, [])

  const toggleTypeFilter = useCallback((typeId: ExperienceTypeId) => {
    setFilter(prev => {
      const current = prev.typeIds ?? []
      const next = current.includes(typeId)
        ? current.filter(t => t !== typeId)
        : [...current, typeId]
      return { ...prev, typeIds: next.length > 0 ? next : undefined }
    })
  }, [])

  const toggleStatusFilter = useCallback((status: ExperienceStatus) => {
    setFilter(prev => {
      const current = prev.statuses ?? []
      const next = current.includes(status)
        ? current.filter(s => s !== status)
        : [...current, status]
      return { ...prev, statuses: next.length > 0 ? next : undefined }
    })
  }, [])

  const toggleTagFilter = useCallback((tag: string) => {
    setFilter(prev => {
      const current = prev.tags ?? []
      const next = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag]
      return { ...prev, tags: next.length > 0 ? next : undefined }
    })
  }, [])

  const clearFilters = useCallback(() => {
    setFilter({ sortBy: "updated" })
  }, [])

  const filteredExperiences = useMemo(() => {
    const matched = experiences.filter(exp => matchesFilter(exp, filter))
    return sortExperiences(matched, filter.sortBy ?? "updated")
  }, [experiences, filter])

  const isFilterActive = !!(filter.search || filter.typeIds || filter.statuses || filter.tags)

  return {
    filter,
    setSearch,
    setSortBy,
    toggleTypeFilter,
    toggleStatusFilter,
    toggleTagFilter,
    clearFilters,
    filteredExperiences,
    isFilterActive,
  }
}
