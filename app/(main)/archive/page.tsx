"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import LibrarySidebar from "@/components/features/archive/LibrarySidebar"
import FilterBar from "@/components/features/archive/FilterBar"
import ExperienceCard from "@/components/features/archive/ExperienceCard"
import RightPanelV2 from "@/components/features/archive/RightPanelV2"
import type { ArchiveModeV2 } from "@/components/features/archive/RightPanelV2"
import type { ExperienceV2, ImportanceLevel } from "@/types/archive"
import { useExperiences } from "@/hooks/useExperiences"
import { useLibraries } from "@/hooks/useLibraries"
import { toExperienceV2 } from "@/lib/utils/experience-mapper"
import { useLibraryFilter, matchesFilter } from "@/hooks/useLibraryFilter"
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper"
import { useBasePath } from "@/lib/utils/use-base-path"

/** @deprecated V1 RightPanel 전용 — V2 는 RightPanelV2 의 ArchiveModeV2 사용. */
export type ArchiveMode = "empty" | "new" | "detail" | "edit"

type MobileView = "list" | "panel"

export default function ArchivePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = useBasePath()

  const [mode, setMode] = useState<ArchiveModeV2>("empty")
  const [mobileView, setMobileView] = useState<MobileView>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [middleCollapsed, setMiddleCollapsed] = useState(false)

  const {
    experiences: apiExperiences,
    isLoading: isExperiencesLoading,
    error: experiencesError,
    refetch: refetchExperiences,
    updateImportance: apiUpdateImportance,
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
    // Only hijack into detail view for an id we haven't already selected — a
    // fresh deep-link or external navigation. If it's already the selected
    // experience, respect the current mode: e.g. the user just entered edit on
    // a freshly-created experience whose `?id` push lands a render later;
    // forcing detail here would clobber edit (a sibling of the FRT-52 races).
    if (selectedId !== idParam) {
      setSelectedId(idParam)
      setMode("detail")
    }
  }

  // Auto-select the first experience once loaded so the desktop detail panel
  // isn't left idle (mobile stays on the list — mobileView gates that
  // independently). We don't push `?id`: this is a view default, not user
  // navigation, so polluting history would be wrong. One-shot — never fights a
  // later new/cancel/delete the user drives.
  const [didAutoSelect, setDidAutoSelect] = useState(false)
  if (
    !didAutoSelect &&
    !idParam &&
    selectedId === null &&
    mode === "empty" &&
    !isLoading &&
    filteredExperiences.length > 0
  ) {
    setDidAutoSelect(true)
    setSelectedId(filteredExperiences[0].id)
    setMode("detail")
  }

  // ── Selection ──────────────────────────────────────────────────────
  const handleSelectExperience = useCallback(
    (id: string) => {
      setSelectedId(id)
      setMode("detail")
      setMobileView("panel")
      router.push(`${basePath}/archive?id=${id}`, { scroll: false })
    },
    [router, basePath]
  )

  // 입력은 별도 라우트로 분리됐다(FRT-74). 새 경험/편집은 더 이상 우측 패널의
  // 폼 모드가 아니라 입력 전용 라우트로 이동한다. 미저장 가드는 입력 뷰 셸
  // (InputViewShell)이 담당하므로 목록 페이지에는 가드가 없다.
  const handleNewExperience = useCallback(() => {
    router.push(`${basePath}/archive/new`)
  }, [router, basePath])

  const handleEditExperience = useCallback(
    (id: string) => {
      router.push(`${basePath}/archive/${id}/edit`)
    },
    [router, basePath]
  )

  // ── CRUD ──────────────────────────────────────────────────────────
  const handleUpdateImportance = useCallback(
    async (id: string, value: ImportanceLevel | undefined) => {
      try {
        await apiUpdateImportance(id, value ?? null)
      } catch (err) {
        const message = err instanceof Error ? err.message : "중요도를 변경하지 못했어요"
        setExperienceActionError(message)
      }
    },
    [apiUpdateImportance],
  )

  const performDelete = useCallback(
    async (id: string) => {
      try {
        await apiDelete(id)
        setExperienceActionError(null)
        setSelectedId(null)
        setMode("empty")
        setMobileView("list")
        router.push(`${basePath}/archive`, { scroll: false })
      } catch (err) {
        const message = err instanceof Error ? err.message : "경험을 삭제하지 못했어요"
        setExperienceActionError(message)
      }
    },
    [apiDelete, router, basePath]
  )

  // 삭제/복제는 상세 패널에서만 트리거되며, 삭제는 ExperienceDetailV2 의 자체
  // 확인 다이얼로그를 거친다. 편집은 별도 라우트로 분리돼 목록 페이지에는
  // 미저장 상태가 없으므로 가드 래퍼가 필요 없다.
  const handleDelete = useCallback(
    (id: string) => {
      void performDelete(id)
    },
    [performDelete]
  )

  const performDuplicate = useCallback(
    async (exp: ExperienceV2) => {
      try {
        const newId = await apiDuplicate(exp.id)
        setExperienceActionError(null)
        setSelectedId(newId)
        setMode("detail")
        router.push(`${basePath}/archive?id=${newId}`, { scroll: false })
      } catch (err) {
        const message = err instanceof Error ? err.message : "경험을 복제하지 못했어요"
        setExperienceActionError(message)
      }
    },
    [apiDuplicate, router, basePath]
  )

  const handleDuplicate = useCallback(
    (exp: ExperienceV2) => {
      void performDuplicate(exp)
    },
    [performDuplicate]
  )

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
        ) : experiencesError ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <p className="text-body">경험 목록을 불러오지 못했어요</p>
            <button
              onClick={() => { void refetchExperiences() }}
              className="text-brand text-body-sm mt-2 hover:text-brand-dark transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : filteredExperiences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 gap-4 text-center text-text-tertiary">
            <p className="text-body">아직 기록한 경험이 없어요</p>
            {/* 모바일 전용 CTA — 데스크톱은 우측 패널 히어로가 유일 CTA(이중 공허 메시지 제거). */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleNewExperience}
              className="md:hidden"
            >
              새 경험 추가하기
            </Button>
          </div>
        ) : (
          filteredExperiences.map(exp => (
            <ExperienceCard
              key={exp.id}
              experience={exp}
              selected={exp.id === selectedId}
              libraries={librariesForCard}
              onClick={() => handleSelectExperience(exp.id)}
              onEdit={() => handleEditExperience(exp.id)}
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
          className="md:ml-[clamp(220px,20vw,300px)] w-[400px] min-w-[320px] max-w-[460px] border-r border-border bg-surface flex-shrink-0 overflow-hidden transition-[width,min-width,opacity] duration-300 ease-in-out"
        >
          {listPanel}
        </div>
        }
        {/* Detail panel */}
        <div className={[
          "flex-1 flex overflow-hidden bg-surface relative",
          middleCollapsed ? "md:ml-[clamp(220px,20vw,300px)]" : "",
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
            onNewExperience={handleNewExperience}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onEdit={() => { if (selectedId) handleEditExperience(selectedId) }}
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
                  onNewExperience={handleNewExperience}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onEdit={() => { if (selectedId) handleEditExperience(selectedId) }}
                  onUpdateImportance={handleUpdateImportance}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
