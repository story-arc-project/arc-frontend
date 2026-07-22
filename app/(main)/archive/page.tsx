"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import LibraryDropdown from "@/components/features/archive/LibraryDropdown"
import FilterBar from "@/components/features/archive/FilterBar"
import ExperienceCard from "@/components/features/archive/ExperienceCard"
import RightPanelV2 from "@/components/features/archive/RightPanelV2"
import type { ExperienceV2, ImportanceLevel } from "@/types/archive"
import { useExperiences } from "@/hooks/useExperiences"
import { useLibraries } from "@/hooks/useLibraries"
import { useReportExperienceCount } from "@/contexts/FeedbackTriggerContext"
import { capture } from "@/lib/analytics"
import { toExperienceV2 } from "@/lib/utils/experience-mapper"
import { useLibraryFilter, matchesFilter } from "@/hooks/useLibraryFilter"
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper"
import { useBasePath } from "@/lib/utils/use-base-path"
import { parseArchiveContext, buildReturnTo } from "@/lib/utils/archive-context"

type MobileView = "list" | "panel"

export default function ArchivePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = useBasePath()

  // FRT-75: 목록이 메인, 미리보기는 카드 클릭 시에만 도킹된다. selectedId 가 곧
  // 미리보기 열림/닫힘 상태다(별도 mode 불필요). 진입 시엔 닫힘(자동선택 폐기).
  const [mobileView, setMobileView] = useState<MobileView>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const {
    experiences: apiExperiences,
    count: experiencesCount,
    isLoading: isExperiencesLoading,
    error: experiencesError,
    refetch: refetchExperiences,
    updateImportance: apiUpdateImportance,
    deleteExperience: apiDelete,
    duplicateExperience: apiDuplicate,
  } = useExperiences()

  // 이미 불러온 개수를 피드백 트리거로 흘린다(FRT-95). 추가 요청은 없다.
  useReportExperienceCount(experiencesCount, isExperiencesLoading)

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

  // FRT-82: 편집/새경험 라우트에서 복귀할 때 나가기 직전의 라이브러리·필터 컨텍스트를
  // returnTo(URL)에 실어 보냈다가 마운트 시 1회 복원한다. 이후엔 사용자 조작이 정본이므로
  // URL 변화를 추적하지 않는다(빈 deps 로 최초 마운트 시점의 searchParams 만 캡처).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const restoredContext = useMemo(() => parseArchiveContext(searchParams), [])

  const [activeLibraryId, setActiveLibraryId] = useState(
    restoredContext?.libraryId ?? ALL_LIBRARY_ID,
  )
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
  } = useLibraryFilter(libraryExperiences, restoredContext?.filter)

  // FRT-82: returnTo 로 복원한 activeLibraryId 가 (다른 기기/탭 삭제 등으로) 더는 존재하지
  // 않는 라이브러리를 가리키면 전체로 폴백한다. libraries 는 비동기 로드라 마운트 시점엔
  // 검증할 수 없으므로 로드 완료 후 1회 보정한다.
  useEffect(() => {
    if (isLibrariesLoading) return
    // 로드 실패 시 libraries 는 시스템 all 만 남고(재시도 배너로 유도) isLoading 은 false 다.
    // 이때 복원된 activeLibraryId 를 "삭제됨"으로 오판해 all 로 덮으면, 재시도가 성공해도
    // 원래 라이브러리 컨텍스트를 되살릴 수 없다. 성공 로드 후에만 보정한다.
    if (librariesError) return
    if (activeLibraryId !== ALL_LIBRARY_ID && !libraries.some(l => l.id === activeLibraryId)) {
      setActiveLibraryId(ALL_LIBRARY_ID)
    }
  }, [isLibrariesLoading, librariesError, libraries, activeLibraryId])

  // Sync ?id= when experiences are loaded (adjust state during render)
  const [syncedForParams, setSyncedForParams] = useState<string | null>(null)
  const idParam = searchParams.get("id")
  if (idParam && idParam !== syncedForParams && experiences.find(e => e.id === idParam)) {
    setSyncedForParams(idParam)
    // `?id` 로의 진입은 특정 레코드로의 의도적 이동(딥링크·입력 라우트 저장 후 복귀)
    // 이므로 미리보기를 도킹 상태로 연다. 이미 선택된 id 면 재진입을 무시한다
    // (selectedId !== idParam 가드: edit→detail sibling race 방지, FRT-52 계열).
    if (selectedId !== idParam) {
      setSelectedId(idParam)
      setMobileView("panel")
    }
  } else if (!idParam && selectedId !== null && syncedForParams === selectedId) {
    // URL 의 ?id 가 사라졌는데(브라우저 Back 등) 미리보기가 열린 채면 닫는다.
    // `syncedForParams === selectedId` 가드로 "선택 직후 push 가 아직 반영 전"인
    // 과도기(이때 syncedForParams 는 아직 이전 값)와 구분해 오탐 클리어를 막는다.
    setSelectedId(null)
    setSyncedForParams(null)
    setMobileView("list")
  }

  // ── Selection ──────────────────────────────────────────────────────
  const handleSelectExperience = useCallback(
    (id: string) => {
      setSelectedId(id)
      setMobileView("panel")
      router.push(`${basePath}/archive?id=${id}`, { scroll: false })
    },
    [router, basePath]
  )

  // 미리보기 닫기(데스크톱 ✕·ESC, 모바일 목록으로). 선택 해제 + ?id 제거 → 풀폭 복귀.
  // syncedForParams 도 함께 비워야 브라우저 Back 으로 ?id 가 돌아왔을 때 다시 도킹된다
  // (안 비우면 idParam === syncedForParams 라 sync 블록이 재선택을 건너뛴다).
  const handleClosePreview = useCallback(() => {
    setSelectedId(null)
    setSyncedForParams(null)
    setMobileView("list")
    router.push(`${basePath}/archive`, { scroll: false })
  }, [router, basePath])

  // ESC 로 미리보기 닫기(데스크톱). 입력 요소 포커스 중엔 무시 — 라이브러리 이름
  // 변경/검색 입력에서의 ESC 가 미리보기를 닫지 않도록 한다.
  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const t = e.target as HTMLElement | null
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return
      // 팝오버/다이얼로그/메뉴(라이브러리 드롭다운·삭제 확인·중요도 선택 등)가 열려
      // 있으면 그쪽이 ESC 를 먼저 소비하도록 양보한다 — 한 번의 ESC 로 미리보기까지 같이
      // 닫혀 선택이 사라지는 것을 막는다. React 리렌더는 이벤트 디스패치 이후라 이 시점엔
      // 해당 노드가 아직 DOM 에 남아 있다.
      if (document.querySelector('[data-archive-popover], [role="dialog"], [role="menu"]')) return
      handleClosePreview()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId, handleClosePreview])

  // 입력은 별도 라우트로 분리됐다(FRT-74). 새 경험/편집은 입력 전용 라우트로
  // 이동한다. 미저장 가드는 입력 뷰 셸(InputViewShell)이 담당한다.
  // FRT-82: 나가기 직전의 라이브러리·필터 컨텍스트를 returnTo 로 인코딩해 입력 라우트에
  // 넘긴다. 입력 라우트는 이 값을 opaque 하게 backTo 로 되돌려주고, 복귀 시 리스트가 복원한다.
  const handleNewExperience = useCallback(() => {
    const returnTo = buildReturnTo(basePath, { libraryId: activeLibraryId, filter })
    router.push(`${basePath}/archive/new?returnTo=${encodeURIComponent(returnTo)}`)
  }, [router, basePath, activeLibraryId, filter])

  const handleEditExperience = useCallback(
    (id: string) => {
      const returnTo = buildReturnTo(basePath, { libraryId: activeLibraryId, filter }, id)
      router.push(`${basePath}/archive/${id}/edit?returnTo=${encodeURIComponent(returnTo)}`)
    },
    [router, basePath, activeLibraryId, filter]
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
        setMobileView("list")
        router.push(`${basePath}/archive`, { scroll: false })
      } catch (err) {
        const message = err instanceof Error ? err.message : "경험을 삭제하지 못했어요"
        setExperienceActionError(message)
      }
    },
    [apiDelete, router, basePath]
  )

  // 삭제/복제는 미리보기에서만 트리거되며, 삭제는 ExperienceDetailV2 의 자체 확인
  // 다이얼로그를 거친다. 편집은 별도 라우트로 분리돼 목록 페이지에는 미저장 상태가
  // 없으므로 가드 래퍼가 필요 없다.
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
        // 복제도 새 기록이 만들어지는 생성 경로다 — 입력 폼만 계측하면 등뼈가 이 사용자를
        // 미기록으로 센다(FRT-19). 서버는 원본을 그대로 복사하므로 유형·상태는 원본 값.
        capture("record_created", { experience_type: exp.typeId, status: exp.status })
        setExperienceActionError(null)
        setSelectedId(newId)
        setMobileView("panel")
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
  const isPreviewOpen = selectedId !== null && selectedExperience !== null

  // ── Toolbar (library dropdown + filter + new experience) ───────────
  const libraryDropdownProps = {
    libraries,
    activeLibraryId,
    experiences,
    onSelectLibrary: handleSelectLibrary,
    onCreateLibrary: handleCreateLibrary,
    onRenameLibrary: handleRenameLibrary,
    onDeleteLibrary: handleDeleteLibrary,
    onUpdateLibraryColor: handleUpdateLibraryColor,
  }

  const filterBarProps = {
    filter,
    isFilterActive,
    onSearchChange: setSearch,
    onSortChange: setSortBy,
    onToggleType: toggleTypeFilter,
    onToggleStatus: toggleStatusFilter,
    onClearFilters: clearFilters,
    onSaveAsLibrary: handleSaveAsLibrary,
  }

  // ── List content (banners + states + cards) ────────────────────────
  const listContent = (
    <div className="flex flex-col gap-2 px-4 py-3">
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
      ) : experiences.length === 0 ? (
        // 진짜 빈 상태(경험 0건) — 단일 히어로 CTA(데스크톱·모바일 공용).
        // 데스크톱 CTA 정확히 1개(FRT-62), size="lg"=h-14 로 모바일 터치타겟 ≥48px.
        <div className="flex flex-col items-center justify-center text-center gap-3 py-20 px-4 text-text-tertiary">
          <div className="w-12 h-12 rounded-xl bg-surface-secondary flex items-center justify-center text-2xl mb-1">
            📋
          </div>
          <p className="text-heading-3 text-text-secondary">기록을 시작해보세요</p>
          <p className="text-body-lg text-text-tertiary leading-relaxed">
            새 경험을 추가해 기록을 남겨보세요
          </p>
          <Button variant="primary" size="lg" onClick={handleNewExperience} className="mt-2">
            새 경험 추가하기
          </Button>
        </div>
      ) : filteredExperiences.length === 0 ? (
        // 경험은 있으나 라이브러리/필터/검색이 전부 제외한 상태. 막다른 길이 되지 않도록
        // 활성 필터 초기화 또는 전체 라이브러리 보기 동작을 제공한다(라이브러리 선택만으로
        // 비어 isFilterActive=false 인 경우 포함).
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 px-4 text-text-tertiary">
          <p className="text-body">조건에 맞는 경험이 없어요</p>
          <div className="flex items-center gap-3">
            {isFilterActive && (
              <button
                onClick={clearFilters}
                className="text-brand text-body-sm hover:text-brand-dark transition-colors"
              >
                필터 초기화
              </button>
            )}
            {activeLibraryId !== ALL_LIBRARY_ID && (
              <button
                onClick={() => handleSelectLibrary(ALL_LIBRARY_ID)}
                className="text-brand text-body-sm hover:text-brand-dark transition-colors"
              >
                전체 보기
              </button>
            )}
          </div>
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
  )

  return (
    <>
      {/* ── Desktop layout (md+) ──────────────────────────────── */}
      <div className="hidden md:flex flex-col h-[calc(100dvh-var(--gnb-h))] overflow-hidden">
        {/* Top control bar */}
        <div className="shrink-0 border-b border-border bg-surface px-4 lg:px-6 py-2.5">
          <div className="flex items-start gap-2">
            <LibraryDropdown {...libraryDropdownProps} className="shrink-0 max-w-[220px]" />
            <FilterBar {...filterBarProps} className="flex-1 min-w-0" />
            <Button
              variant="primary"
              size="md"
              onClick={handleNewExperience}
              className="shrink-0"
            >
              <Plus size={16} className="mr-1" />
              새 경험 추가
            </Button>
          </div>
        </div>

        {/* Body: full-width list ↔ list + docked preview */}
        <div className="flex-1 flex overflow-hidden bg-surface">
          <div
            className={
              isPreviewOpen
                ? "w-[360px] min-w-[320px] max-w-[400px] shrink-0 border-r border-border overflow-y-auto"
                : "flex-1 overflow-y-auto"
            }
          >
            <div className={isPreviewOpen ? "" : "mx-auto w-full max-w-3xl"}>
              {listContent}
            </div>
          </div>

          {isPreviewOpen && (
            <div className="flex-1 flex flex-col overflow-hidden bg-surface">
              <div className="shrink-0 flex items-center justify-between px-4 h-11 border-b border-border">
                <span className="text-caption text-text-tertiary">미리보기</span>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  aria-label="미리보기 닫기"
                  className="p-1 -mr-1 text-text-tertiary hover:text-text-secondary transition-colors rounded"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <RightPanelV2
                  selectedExperience={selectedExperience}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onEdit={() => handleEditExperience(selectedExperience.id)}
                  onUpdateImportance={handleUpdateImportance}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile layout (<md) ───────────────────────────────── */}
      <div className="md:hidden relative h-[calc(100dvh-var(--gnb-h))] overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          {mobileView === "list" ? (
            <motion.div
              key="list"
              className="absolute inset-0 flex flex-col"
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Mobile control bar */}
              <div className="shrink-0 border-b border-border bg-surface px-4 py-2.5 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <LibraryDropdown {...libraryDropdownProps} className="flex-1 min-w-0" />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleNewExperience}
                    className="shrink-0"
                    aria-label="새 경험 추가"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
                <FilterBar {...filterBarProps} />
              </div>
              <div className="flex-1 overflow-y-auto">
                {listContent}
              </div>
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
                  onClick={handleClosePreview}
                  aria-label="목록으로 돌아가기"
                  className="flex items-center gap-1.5 text-label text-brand hover:text-brand-dark transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>목록으로</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedExperience && (
                  <RightPanelV2
                    selectedExperience={selectedExperience}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onEdit={() => handleEditExperience(selectedExperience.id)}
                    onUpdateImportance={handleUpdateImportance}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
