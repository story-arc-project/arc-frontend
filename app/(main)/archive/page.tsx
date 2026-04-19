"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import LibrarySidebar from "@/components/features/archive/LibrarySidebar"
import FilterBar from "@/components/features/archive/FilterBar"
import ExperienceCard from "@/components/features/archive/ExperienceCard"
import RightPanelV2 from "@/components/features/archive/RightPanelV2"
import type { ArchiveModeV2 } from "@/components/features/archive/RightPanelV2"
import type { ExperienceV2, ImportanceLevel } from "@/types/archive"
import { useExperiences } from "@/hooks/useExperiences"
import { useLibraries } from "@/hooks/useLibraries"
import {
  toExperienceV2,
  toSavePayload,
  toUpdateImportancePayload,
} from "@/lib/utils/experience-mapper"
import { useLibraryFilter, matchesFilter } from "@/hooks/useLibraryFilter"
import { usePresets } from "@/hooks/usePresets"
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper"

/** @deprecated Use ArchiveModeV2 from RightPanelV2 */
export type ArchiveMode = "empty" | "new" | "detail" | "edit"

type MobileView = "list" | "panel"

export default function ArchivePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<ArchiveModeV2>("empty")
  const [mobileView, setMobileView] = useState<MobileView>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [pendingSelectId, setPendingSelectId] = useState<string | null | undefined>(undefined)
  const [showGuardModal, setShowGuardModal] = useState(false)

  const [middleCollapsed, setMiddleCollapsed] = useState(false)

  const {
    experiences: apiExperiences,
    isLoading: isExperiencesLoading,
    createExperience: apiCreate,
    updateExperience: apiUpdate,
    deleteExperience: apiDelete,
    duplicateExperience: apiDuplicate,
  } = useExperiences()

  const experiences = useMemo(() => apiExperiences.map(toExperienceV2), [apiExperiences])

  const {
    libraries,
    isLoading: isLibrariesLoading,
    error: librariesError,
    refetch: refetchLibraries,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    addExperienceToLibrary,
    removeExperienceFromLibrary,
    retryLibraryMembership,
    loadingMembershipIds,
    loadedMembershipIds,
    membershipErrorIds,
  } = useLibraries()

  const [activeLibraryId, setActiveLibraryId] = useState(ALL_LIBRARY_ID)
  const [libraryActionError, setLibraryActionError] = useState<string | null>(null)
  const [experienceActionError, setExperienceActionError] = useState<string | null>(null)
  const presetsHook = usePresets()

  // Ref mirror lets deferred callbacks (e.g. delete onSuccess) read the current
  // active library instead of the value captured when the request was dispatched.
  const activeLibraryIdRef = useRef(activeLibraryId)
  useEffect(() => { activeLibraryIdRef.current = activeLibraryId }, [activeLibraryId])

  const runLibraryAction = useCallback(
    (promise: Promise<void>, failMsg: string, onSuccess?: () => void) => {
      promise
        .then(() => {
          onSuccess?.()
        })
        .catch(() => {
          // Keep prior banners if they're unrelated; only overwrite with the
          // latest failure. Users dismiss manually via the close button.
          setLibraryActionError(failMsg)
        })
    },
    [],
  )

  // Library-scoped experiences: system=all, filter-based=smart match, manual=by IDs
  const activeLibrary = libraries.find(l => l.id === activeLibraryId)
  const isActiveManual = !!activeLibrary && !activeLibrary.isSystem && !activeLibrary.filter
  const activeLibraryHasError =
    isActiveManual && membershipErrorIds.has(activeLibrary!.id)
  const isManualMembershipPending =
    isActiveManual &&
    !activeLibraryHasError &&
    (loadingMembershipIds.has(activeLibrary!.id) || !loadedMembershipIds.has(activeLibrary!.id))
  const isLoading = isExperiencesLoading || isLibrariesLoading || isManualMembershipPending

  // ExperienceCard reads `experienceIds` for every manual library to decide
  // which library badges to render and which submenu items to mark as already
  // a member. That state is background-hydrated by `useLibraries`, so until
  // *all* manual libraries have *settled* (loaded or errored) we must not pass
  // a partially-hydrated list to the card — otherwise the "전체" view shows
  // missing badges and the "라이브러리 이동" submenu reports false "unchecked"
  // entries, letting users send duplicate add requests.
  //
  // Errored libraries count as settled for gating purposes so a single
  // failure doesn't permanently disable library actions across the whole
  // archive. However, we must also *strip* errored libraries from the list
  // we hand to the card: their `experienceIds` is empty-by-failure, not
  // empty-by-truth, so leaving them in would let the submenu offer a
  // spurious "add" action that could duplicate an existing membership on the
  // server. The retry banner below surfaces those libraries separately.
  const manualLibraries = libraries.filter(l => !l.isSystem && !l.filter)
  const erroredManualLibraries = manualLibraries.filter(l => membershipErrorIds.has(l.id))
  const allMembershipsSettled = manualLibraries.every(
    l => loadedMembershipIds.has(l.id) || membershipErrorIds.has(l.id),
  )
  const librariesForCard = allMembershipsSettled
    ? libraries.filter(l => !membershipErrorIds.has(l.id))
    : undefined
  const hasMembershipErrors = erroredManualLibraries.length > 0

  const retryAllFailedMemberships = useCallback(() => {
    erroredManualLibraries.forEach(l => { void retryLibraryMembership(l.id) })
  }, [erroredManualLibraries, retryLibraryMembership])

  const libraryExperiences = activeLibraryId === ALL_LIBRARY_ID
    ? experiences
    : activeLibrary?.filter
      ? experiences.filter(e => matchesFilter(e, activeLibrary.filter!))
      : experiences.filter(e => activeLibrary?.experienceIds.includes(e.id))

  const {
    filter,
    filteredExperiences,
    isFilterActive,
    setSearch,
    setSortBy,
    toggleTypeFilter,
    toggleStatusFilter,
    clearFilters,
  } = useLibraryFilter(libraryExperiences)

  // Sync ?id= when experiences are loaded (adjust state during render)
  const [syncedForParams, setSyncedForParams] = useState<string | null>(null)
  const idParam = searchParams.get("id")
  if (idParam && idParam !== syncedForParams && experiences.find(e => e.id === idParam)) {
    setSyncedForParams(idParam)
    setSelectedId(idParam)
    setMode("detail")
  }

  // ── Selection ──────────────────────────────────────────────────────
  const handleSelectExperience = useCallback(
    (id: string) => {
      if (hasUnsaved) {
        setPendingSelectId(id)
        setShowGuardModal(true)
        return
      }
      setSelectedId(id)
      setMode("detail")
      setMobileView("panel")
      router.push(`/archive?id=${id}`, { scroll: false })
    },
    [hasUnsaved, router]
  )

  const handleNewExperience = useCallback(() => {
    if (hasUnsaved) {
      setPendingSelectId(null)
      setShowGuardModal(true)
      return
    }
    setSelectedId(null)
    setMode("new")
    setMobileView("panel")
    router.push("/archive", { scroll: false })
  }, [hasUnsaved, router])

  // ── CRUD ──────────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (exp: ExperienceV2) => {
      try {
        const payload = toSavePayload(exp)
        const exists = experiences.some(e => e.id === exp.id)
        let savedId: string
        if (exists) {
          await apiUpdate(exp.id, {
            content: payload.content,
            importance: payload.importance,
          })
          savedId = exp.id
        } else {
          savedId = await apiCreate(payload)
        }
        setExperienceActionError(null)
        setSelectedId(savedId)
        setMode("detail")
        setHasUnsaved(false)
        router.push(`/archive?id=${savedId}`, { scroll: false })
      } catch (err) {
        const message = err instanceof Error ? err.message : "경험을 저장하지 못했어요"
        setExperienceActionError(message)
      }
    },
    [experiences, apiCreate, apiUpdate, router]
  )

  const handleUpdateImportance = useCallback(
    async (id: string, value: ImportanceLevel | undefined) => {
      try {
        await apiUpdate(id, toUpdateImportancePayload(value))
      } catch (err) {
        const message = err instanceof Error ? err.message : "중요도를 변경하지 못했어요"
        setExperienceActionError(message)
      }
    },
    [apiUpdate],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await apiDelete(id)
        setExperienceActionError(null)
        setSelectedId(null)
        setMode("empty")
        setMobileView("list")
        setHasUnsaved(false)
        router.push("/archive", { scroll: false })
      } catch (err) {
        const message = err instanceof Error ? err.message : "경험을 삭제하지 못했어요"
        setExperienceActionError(message)
      }
    },
    [apiDelete, router]
  )

  const handleDuplicate = useCallback(
    async (exp: ExperienceV2) => {
      try {
        const newId = await apiDuplicate(exp.id)
        setExperienceActionError(null)
        setSelectedId(newId)
        setMode("detail")
        router.push(`/archive?id=${newId}`, { scroll: false })
      } catch (err) {
        const message = err instanceof Error ? err.message : "경험을 복제하지 못했어요"
        setExperienceActionError(message)
      }
    },
    [apiDuplicate, router]
  )

  const handleCancel = useCallback(() => {
    setHasUnsaved(false)
    if (selectedId) {
      setMode("detail")
    } else {
      setMode("empty")
      setMobileView("list")
    }
  }, [selectedId])

  // ── Library management ────────────────────────────────────────────
  const handleSelectLibrary = useCallback((id: string) => {
    setActiveLibraryId(id)
    setMiddleCollapsed(false)
  }, [])

  const handleCreateLibrary = useCallback((name: string) => {
    runLibraryAction(
      createLibrary({ name, isSystem: false }),
      "라이브러리를 만들지 못했어요",
    )
  }, [createLibrary, runLibraryAction])

  const handleRenameLibrary = useCallback((id: string, name: string) => {
    const library = libraries.find((item) => item.id === id)
    if (!library) return

    runLibraryAction(
      updateLibrary(id, {
        name,
        color: library.color,
        icon: library.icon,
        filter: library.filter,
      }),
      "라이브러리 이름을 변경하지 못했어요",
    )
  }, [libraries, updateLibrary, runLibraryAction])

  const handleUpdateLibraryColor = useCallback((id: string, color: string) => {
    const library = libraries.find((item) => item.id === id)
    if (!library) return

    runLibraryAction(
      updateLibrary(id, {
        name: library.name,
        color,
        icon: library.icon,
        filter: library.filter,
      }),
      "라이브러리 색상을 변경하지 못했어요",
    )
  }, [libraries, updateLibrary, runLibraryAction])

  const handleDeleteLibrary = useCallback((id: string) => {
    runLibraryAction(
      deleteLibrary(id),
      "라이브러리를 삭제하지 못했어요",
      () => {
        if (activeLibraryIdRef.current === id) {
          setActiveLibraryId(ALL_LIBRARY_ID)
          clearFilters()
        }
      },
    )
  }, [clearFilters, deleteLibrary, runLibraryAction])

  const handleMoveToLibrary = useCallback((experienceId: string, libraryId: string) => {
    const library = libraries.find((item) => item.id === libraryId)
    if (!library || library.isSystem || library.filter) return

    if (library.experienceIds.includes(experienceId)) {
      runLibraryAction(
        removeExperienceFromLibrary(libraryId, experienceId),
        "라이브러리에서 제거하지 못했어요",
      )
      return
    }

    runLibraryAction(
      addExperienceToLibrary(libraryId, experienceId),
      "라이브러리에 추가하지 못했어요",
    )
  }, [addExperienceToLibrary, libraries, removeExperienceFromLibrary, runLibraryAction])

  // ── Save current filter as smart library ───────────────────────────
  const handleSaveAsLibrary = useCallback((name: string) => {
    runLibraryAction(
      createLibrary({
        name,
        isSystem: false,
        filter: { ...filter },
      }),
      "라이브러리를 만들지 못했어요",
    )
  }, [createLibrary, filter, runLibraryAction])

  // ── Unsaved guard ─────────────────────────────────────────────────
  const confirmDiscard = useCallback(() => {
    setShowGuardModal(false)
    setHasUnsaved(false)
    if (pendingSelectId === null) {
      setSelectedId(null)
      setMode("new")
      setMobileView("panel")
      router.push("/archive", { scroll: false })
    } else if (pendingSelectId !== undefined) {
      setSelectedId(pendingSelectId)
      setMode("detail")
      setMobileView("panel")
      router.push(`/archive?id=${pendingSelectId}`, { scroll: false })
    }
    setPendingSelectId(undefined)
  }, [pendingSelectId, router])

  // ── Derived ───────────────────────────────────────────────────────
  const selectedExperience = experiences.find(e => e.id === selectedId) ?? null

  // ── List panel (sidebar + filter bar + card list) ─────────────────
  const listPanel = (
    <div className="flex flex-col h-full">
      {/* Collapse toggle header (desktop only) */}
      <div className="hidden md:flex items-center justify-end px-3 py-1.5 border-b border-border bg-surface shrink-0">
        <button
          type="button"
          onClick={() => setMiddleCollapsed(true)}
          className="p-1 text-text-tertiary hover:text-text-secondary transition-colors rounded"
          aria-label="패널 접기"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
      <FilterBar
        filter={filter}
        isFilterActive={isFilterActive}
        onSearchChange={setSearch}
        onSortChange={setSortBy}
        onToggleType={toggleTypeFilter}
        onToggleStatus={toggleStatusFilter}
        onClearFilters={clearFilters}
        onSaveAsLibrary={handleSaveAsLibrary}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {hasMembershipErrors && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-surface text-text-secondary text-body-sm">
            <p>
              일부 라이브러리({erroredManualLibraries.map(l => l.name).join(", ")})를 불러오지 못했어요
            </p>
            <button
              onClick={retryAllFailedMemberships}
              className="text-brand hover:text-brand-dark transition-colors shrink-0"
            >
              다시 시도
            </button>
          </div>
        )}
        {libraryActionError && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-surface text-text-secondary text-body-sm"
          >
            <p>{libraryActionError}</p>
            <button
              onClick={() => setLibraryActionError(null)}
              className="text-brand hover:text-brand-dark transition-colors shrink-0"
            >
              닫기
            </button>
          </div>
        )}
        {experienceActionError && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-surface text-text-secondary text-body-sm"
          >
            <p>{experienceActionError}</p>
            <button
              onClick={() => setExperienceActionError(null)}
              className="text-brand hover:text-brand-dark transition-colors shrink-0"
            >
              닫기
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-tertiary">
            <p className="text-body">불러오는 중…</p>
          </div>
        ) : librariesError ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <p className="text-body">라이브러리 목록을 불러오지 못했어요</p>
            <button
              onClick={() => { void refetchLibraries() }}
              className="text-brand text-body-sm mt-2 hover:text-brand-dark transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : activeLibraryHasError ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <p className="text-body">라이브러리를 불러오지 못했어요</p>
            <button
              onClick={() => { void retryLibraryMembership(activeLibrary!.id) }}
              className="text-brand text-body-sm mt-2 hover:text-brand-dark transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : filteredExperiences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <p className="text-body">경험이 없습니다</p>
            <button
              onClick={handleNewExperience}
              className="text-brand text-body-sm mt-2 hover:text-brand-dark transition-colors"
            >
              새 경험 추가하기
            </button>
          </div>
        ) : (
          filteredExperiences.map(exp => (
            <ExperienceCard
              key={exp.id}
              experience={exp}
              selected={exp.id === selectedId}
              libraries={librariesForCard}
              onClick={() => handleSelectExperience(exp.id)}
              onEdit={() => { handleSelectExperience(exp.id); setTimeout(() => setMode("edit"), 0) }}
              onDuplicate={() => handleDuplicate(exp)}
              onDelete={() => handleDelete(exp.id)}
              onMoveToLibrary={(libId) => handleMoveToLibrary(exp.id, libId)}
            />
          ))
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop layout (md+) ──────────────────────────────── */}
      <div className="hidden md:flex h-[calc(100dvh-var(--gnb-h))] overflow-hidden">
        <LibrarySidebar
          libraries={libraries}
          activeLibraryId={activeLibraryId}
          experiences={experiences}
          onSelectLibrary={handleSelectLibrary}
          onCreateLibrary={handleCreateLibrary}
          onRenameLibrary={handleRenameLibrary}
          onDeleteLibrary={handleDeleteLibrary}
          onUpdateLibraryColor={handleUpdateLibraryColor}
          onNewExperience={handleNewExperience}
        />
        {/* Card list area */}
        {!middleCollapsed &&
        <div
          className="md:ml-[20vw] w-[340px] min-w-[280px] max-w-[400px] border-r border-border bg-surface flex-shrink-0 overflow-hidden transition-[width,min-width,opacity] duration-300 ease-in-out"
        >
          {listPanel}
        </div>
        }
        {/* Detail panel */}
        <div className={[
          "flex-1 flex overflow-hidden bg-surface relative",
          middleCollapsed ? "md:ml-[20vw]" : "",
        ].join(" ")}>
          {/* Expand button when middle panel is collapsed */}
          {middleCollapsed && (
            <button
              type="button"
              onClick={() => setMiddleCollapsed(false)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-surface border border-border border-l-0 rounded-r-md p-1.5 text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors shadow-sm"
              aria-label="패널 펼치기"
            >
              <ChevronRight size={16} />
            </button>
          )}
          <RightPanelV2
            mode={mode}
            selectedExperience={selectedExperience}
            presetsHook={presetsHook}
            onNewExperience={handleNewExperience}
            onSave={handleSave}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onCancel={handleCancel}
            onEdit={() => setMode("edit")}
            onUnsavedChange={setHasUnsaved}
            onUpdateImportance={handleUpdateImportance}
          />
        </div>
      </div>

      {/* ── Mobile layout (<md) ───────────────────────────────── */}
      <div className="md:hidden relative h-[calc(100dvh-var(--gnb-h))] overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          {mobileView === "list" ? (
            <motion.div
              key="list"
              className="absolute inset-0"
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {listPanel}
            </motion.div>
          ) : (
            <motion.div
              key="panel"
              className="absolute inset-0 flex flex-col"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex-shrink-0 flex items-center px-4 h-11 border-b border-border bg-surface">
                <button
                  onClick={() => setMobileView("list")}
                  aria-label="목록으로 돌아가기"
                  className="flex items-center gap-1.5 text-label text-brand hover:text-brand-dark transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>목록으로</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <RightPanelV2
                  mode={mode}
                  selectedExperience={selectedExperience}
                  presetsHook={presetsHook}
                  onNewExperience={handleNewExperience}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onCancel={handleCancel}
                  onEdit={() => setMode("edit")}
                  onUnsavedChange={setHasUnsaved}
                  onUpdateImportance={handleUpdateImportance}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Unsaved changes guard modal ───────────────────────── */}
      <Dialog open={showGuardModal} onClose={() => setShowGuardModal(false)} ariaLabel="저장하지 않고 나갈까요?">
        <h3 className="text-title text-text-primary mb-2">저장하지 않고 나갈까요?</h3>
        <p className="text-body-sm text-text-secondary mb-6 leading-relaxed">
          작성 중인 내용이 있어요. 나가면 사라져요.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowGuardModal(false)}>
            취소
          </Button>
          <Button variant="destructive" size="sm" onClick={confirmDiscard}>
            나가기
          </Button>
        </div>
      </Dialog>
    </>
  )
}
