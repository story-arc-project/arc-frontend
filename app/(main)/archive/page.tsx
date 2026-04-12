"use client"

import { useState, useCallback, useEffect } from "react"
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
import type { ExperienceV2, Library } from "@/types/archive"
import { useExperiences } from "@/hooks/useExperiences"
import { toExperienceV2, toSavePayload } from "@/lib/experience-mapper"
import { useLibraryFilter, matchesFilter } from "@/hooks/useLibraryFilter"
import { cloneBlocks, uid } from "@/lib/block-utils"
import { usePresets } from "@/hooks/usePresets"

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
    isLoading,
    createExperience: apiCreate,
    updateExperience: apiUpdate,
    deleteExperience: apiDelete,
  } = useExperiences()

  const experiences = apiExperiences.map(toExperienceV2)

  const defaultLibraries: Library[] = [
    { id: "lib-all", name: "전체", isSystem: true, experienceIds: [] },
  ]
  const [libraries, setLibraries] = useState<Library[]>(defaultLibraries)
  const [activeLibraryId, setActiveLibraryId] = useState("lib-all")
  const presetsHook = usePresets()

  // Library-scoped experiences: system=all, filter-based=smart match, manual=by IDs
  const activeLibrary = libraries.find(l => l.id === activeLibraryId)
  const libraryExperiences = activeLibraryId === "lib-all"
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

  // Sync ?id= on first mount
  useEffect(() => {
    const id = searchParams.get("id")
    if (id && experiences.find(e => e.id === id)) {
      setSelectedId(id)
      setMode("detail")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      const payload = toSavePayload(exp)
      const exists = experiences.some(e => e.id === exp.id)
      const saved = exists
        ? await apiUpdate(exp.id, payload)
        : await apiCreate(payload)
      setSelectedId(saved.id)
      setMode("detail")
      setHasUnsaved(false)
      router.push(`/archive?id=${saved.id}`, { scroll: false })
    },
    [experiences, apiCreate, apiUpdate, router]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await apiDelete(id)
      setLibraries(prev =>
        prev.map(lib =>
          lib.isSystem ? lib : { ...lib, experienceIds: lib.experienceIds.filter(eid => eid !== id) }
        )
      )
      setSelectedId(null)
      setMode("empty")
      setMobileView("list")
      setHasUnsaved(false)
      router.push("/archive", { scroll: false })
    },
    [apiDelete, router]
  )

  const handleDuplicate = useCallback(
    async (exp: ExperienceV2) => {
      const clone: ExperienceV2 = {
        ...exp,
        id: uid("exp"),
        title: `${exp.title} (복사본)`,
        status: "draft",
        coreBlocks: cloneBlocks(exp.coreBlocks),
        extensionBlocks: cloneBlocks(exp.extensionBlocks),
        customBlocks: cloneBlocks(exp.customBlocks),
      }
      const payload = toSavePayload(clone)
      const created = await apiCreate(payload)
      setSelectedId(created.id)
      setMode("detail")
      router.push(`/archive?id=${created.id}`, { scroll: false })
    },
    [apiCreate, router]
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
    const newLib: Library = {
      id: uid("lib"),
      name,
      isSystem: false,
      experienceIds: [],
    }
    setLibraries(prev => [...prev, newLib])
  }, [])

  const handleRenameLibrary = useCallback((id: string, name: string) => {
    setLibraries(prev => prev.map(l => (l.id === id ? { ...l, name } : l)))
  }, [])

  const handleUpdateLibraryColor = useCallback((id: string, color: string) => {
    setLibraries(prev => prev.map(l => (l.id === id ? { ...l, color } : l)))
  }, [])

  const handleDeleteLibrary = useCallback((id: string) => {
    setLibraries(prev => prev.filter(l => l.id !== id))
    if (activeLibraryId === id) {
      setActiveLibraryId("lib-all")
      clearFilters()
    }
  }, [activeLibraryId, clearFilters])

  const handleMoveToLibrary = useCallback((experienceId: string, libraryId: string) => {
    setLibraries(prev =>
      prev.map(lib => {
        if (lib.isSystem) return lib
        if (lib.id === libraryId) {
          // Toggle: add if not present, remove if already in
          const ids = lib.experienceIds.includes(experienceId)
            ? lib.experienceIds.filter(id => id !== experienceId)
            : [...lib.experienceIds, experienceId]
          return { ...lib, experienceIds: ids }
        }
        return lib
      })
    )
  }, [])

  // ── Save current filter as smart library ───────────────────────────
  const handleSaveAsLibrary = useCallback((name: string) => {
    const newLib: Library = {
      id: uid("lib"),
      name,
      isSystem: false,
      experienceIds: [],
      filter: { ...filter },
    }
    setLibraries(prev => [...prev, newLib])
  }, [filter])

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
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-tertiary">
            <p className="text-body">불러오는 중…</p>
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
              libraries={libraries}
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
