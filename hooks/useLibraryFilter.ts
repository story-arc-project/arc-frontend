"use client"

import { useState, useMemo, useCallback } from "react"
import { canonicalTypeId } from "@/lib/constants/templates-v2"
import { equivalentLabels } from "@/lib/utils/form-cards"
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

export function matchesFilter(exp: ExperienceV2, filter: LibraryFilter): boolean {
  if (filter.search) {
    const q = filter.search.toLowerCase()
    const inTitle = exp.title.toLowerCase().includes(q)
    const inSummary = exp.summary.toLowerCase().includes(q)
    const inTags = exp.tags.some(t => t.toLowerCase().includes(q))
    if (!inTitle && !inSummary && !inTags) return false
  }
  if (filter.typeIds && filter.typeIds.length > 0) {
    // 은퇴한 유형 id 는 현행 id 로 접어서 비교한다 — 목록에서 내린 id 는 칩이 없어, 정확 일치로
    // 거르면 옛 레코드를 다시 보이게 할 방법이 사라진다(FRT-291 `canonicalTypeId`).
    const target = canonicalTypeId(exp.typeId)
    if (!filter.typeIds.some(id => canonicalTypeId(id) === target)) return false
  }
  if (filter.statuses && filter.statuses.length > 0) {
    if (!filter.statuses.includes(exp.status)) return false
  }
  if (filter.tags && filter.tags.length > 0) {
    if (!filter.tags.some(t => exp.tags.includes(t))) return false
  }
  return true
}

/**
 * 정렬에 쓰는 시작 시점 (FRT-291 리뷰).
 *
 * 코어 '기간'을 먼저 보고, 없으면 **유형 섹션이 대신 소유한 시점**을 찾는다. 확정본 정렬로
 * 여러 유형이 `CORE_EXCLUDE` 로 코어 '기간'을 내리고 자기 라벨('진행 기간'·'연구 기간'…)로
 * 옮겨 갔는데, 코어만 보면 그 유형들이 전부 빈 문자열로 같아져 기간 정렬이 아무 일도 하지 않는다.
 *
 * 라벨 후보는 `SEMANTIC_GROUPS.period`(form-cards)를 그대로 쓴다 — 어떤 라벨이 '기간'과 같은
 * 질문인지는 이미 그 표가 정본이고, 사본을 두면 새 유형이 추가될 때 한쪽만 갱신돼 조용히
 * 어긋난다. 코어를 먼저 보므로 기존 유형의 정렬 결과는 한 건도 바뀌지 않는다.
 */
function periodStart(exp: ExperienceV2): string {
  const core = exp.coreBlocks.find(bl => bl.label === "기간")
  if (core?.value.type === "period" && core.value.start) return core.value.start

  const group = equivalentLabels("기간")
  for (const bl of exp.extensionBlocks) {
    if (bl.value.type === "period" && bl.value.start && group.includes(bl.label)) {
      return bl.value.start
    }
  }
  return ""
}

function sortExperiences(experiences: ExperienceV2[], sortBy: SortBy): ExperienceV2[] {
  const sorted = [...experiences]
  switch (sortBy) {
    case "updated":
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      break
    case "period":
      sorted.sort((a, b) => periodStart(b).localeCompare(periodStart(a)))
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

export function useLibraryFilter(
  experiences: ExperienceV2[],
  initialFilter?: LibraryFilter,
): UseLibraryFilterReturn {
  // initialFilter 는 마운트 시 1회 복원용(FRT-82: 편집 라우트 왕복 후 필터 재구성).
  // 이후 URL 변화를 추적하지 않으므로 lazy initializer 로 최초 값만 캡처한다.
  const [filter, setFilter] = useState<LibraryFilter>(
    () => initialFilter ?? { sortBy: "updated" },
  )

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
