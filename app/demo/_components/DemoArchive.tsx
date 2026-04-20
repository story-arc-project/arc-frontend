"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import LibrarySidebar from "@/components/features/archive/LibrarySidebar";
import FilterBar from "@/components/features/archive/FilterBar";
import ExperienceCard from "@/components/features/archive/ExperienceCard";
import RightPanelV2 from "@/components/features/archive/RightPanelV2";
import type { ArchiveModeV2 } from "@/components/features/archive/RightPanelV2";
import type { ExperienceV2, Library, ImportanceLevel, Preset, Block } from "@/types/archive";
import type { UsePresetsReturn } from "@/hooks/usePresets";
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper";
import { useLibraryFilter, matchesFilter } from "@/hooks/useLibraryFilter";
import { demoExperiences } from "../_data/experiences";
import { demoLibraries } from "../_data/libraries";

type MobileView = "list" | "panel";

interface DemoArchiveProps {
  initialMode: ArchiveModeV2;
  initialSelectedId?: string | null;
}

function createStubPresetsHook(): UsePresetsReturn {
  const noop = async () => {};
  return {
    presets: [] as Preset[],
    isLoading: false,
    error: null,
    refetch: async () => {},
    createPreset: async (_name: string, _blocks: Block[]) => {
      void _name;
      void _blocks;
    },
    updatePreset: async (_id: string) => {
      void _id;
      return noop();
    },
    deletePreset: async (_id: string) => {
      void _id;
      return noop();
    },
    duplicatePreset: async (_id: string) => {
      void _id;
      return noop();
    },
    getPreset: () => undefined,
  };
}

export default function DemoArchive({ initialMode, initialSelectedId }: DemoArchiveProps) {
  const [experiences, setExperiences] = useState<ExperienceV2[]>(demoExperiences);
  const [libraries, setLibraries] = useState<Library[]>(demoLibraries);
  const [activeLibraryId, setActiveLibraryId] = useState<string>(ALL_LIBRARY_ID);
  const [mode, setMode] = useState<ArchiveModeV2>(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [mobileView, setMobileView] = useState<MobileView>(
    initialMode === "empty" ? "list" : "panel",
  );
  const [middleCollapsed, setMiddleCollapsed] = useState(false);

  const presetsHook = useMemo(() => createStubPresetsHook(), []);

  const activeLibrary = libraries.find((l) => l.id === activeLibraryId);
  const libraryExperiences =
    activeLibraryId === ALL_LIBRARY_ID
      ? experiences
      : activeLibrary?.filter
        ? experiences.filter((e) => matchesFilter(e, activeLibrary.filter!))
        : experiences.filter((e) => activeLibrary?.experienceIds.includes(e.id));

  const {
    filter,
    filteredExperiences,
    isFilterActive,
    setSearch,
    setSortBy,
    toggleTypeFilter,
    toggleStatusFilter,
    clearFilters,
  } = useLibraryFilter(libraryExperiences);

  const selectedExperience = experiences.find((e) => e.id === selectedId) ?? null;

  const handleSelectExperience = useCallback((id: string) => {
    setSelectedId(id);
    setMode("detail");
    setMobileView("panel");
  }, []);

  const handleNewExperience = useCallback(() => {
    setSelectedId(null);
    setMode("new");
    setMobileView("panel");
  }, []);

  const handleSave = useCallback((exp: ExperienceV2) => {
    setExperiences((prev) => {
      const exists = prev.some((e) => e.id === exp.id);
      if (exists) return prev.map((e) => (e.id === exp.id ? exp : e));
      return [exp, ...prev];
    });
    setSelectedId(exp.id);
    setMode("detail");
  }, []);

  const handleDelete = useCallback((id: string) => {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
    setSelectedId(null);
    setMode("empty");
    setMobileView("list");
  }, []);

  const handleDuplicate = useCallback((exp: ExperienceV2) => {
    const now = new Date().toISOString();
    const newId = `${exp.id}-copy-${Date.now()}`;
    const copy: ExperienceV2 = {
      ...exp,
      id: newId,
      title: `${exp.title} (복제)`,
      createdAt: now,
      updatedAt: now,
    };
    setExperiences((prev) => [copy, ...prev]);
    setSelectedId(newId);
    setMode("detail");
  }, []);

  const handleCancel = useCallback(() => {
    if (selectedId) setMode("detail");
    else {
      setMode("empty");
      setMobileView("list");
    }
  }, [selectedId]);

  const handleUpdateImportance = useCallback(
    (id: string, value: ImportanceLevel | undefined) => {
      setExperiences((prev) =>
        prev.map((e) => (e.id === id ? { ...e, importance: value } : e)),
      );
    },
    [],
  );

  // Library handlers (demo: local state only)
  const handleSelectLibrary = useCallback((id: string) => {
    setActiveLibraryId(id);
    setMiddleCollapsed(false);
  }, []);

  const handleCreateLibrary = useCallback((name: string) => {
    setLibraries((prev) => [
      ...prev,
      { id: `lib-${Date.now()}`, name, isSystem: false, experienceIds: [] },
    ]);
  }, []);

  const handleRenameLibrary = useCallback((id: string, name: string) => {
    setLibraries((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  }, []);

  const handleUpdateLibraryColor = useCallback((id: string, color: string) => {
    setLibraries((prev) => prev.map((l) => (l.id === id ? { ...l, color } : l)));
  }, []);

  const handleDeleteLibrary = useCallback((id: string) => {
    setLibraries((prev) => prev.filter((l) => l.id !== id));
    if (activeLibraryId === id) setActiveLibraryId(ALL_LIBRARY_ID);
  }, [activeLibraryId]);

  const handleMoveToLibrary = useCallback((experienceId: string, libraryId: string) => {
    setLibraries((prev) =>
      prev.map((l) => {
        if (l.id !== libraryId || l.isSystem || l.filter) return l;
        const has = l.experienceIds.includes(experienceId);
        return {
          ...l,
          experienceIds: has
            ? l.experienceIds.filter((id) => id !== experienceId)
            : [...l.experienceIds, experienceId],
        };
      }),
    );
  }, []);

  const handleSaveAsLibrary = useCallback((name: string) => {
    setLibraries((prev) => [
      ...prev,
      {
        id: `lib-${Date.now()}`,
        name,
        isSystem: false,
        experienceIds: [],
        filter: { ...filter },
      },
    ]);
  }, [filter]);

  const listPanel = (
    <div className="flex flex-col h-full">
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
        {filteredExperiences.length === 0 ? (
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
          filteredExperiences.map((exp) => (
            <ExperienceCard
              key={exp.id}
              experience={exp}
              selected={exp.id === selectedId}
              libraries={libraries}
              onClick={() => handleSelectExperience(exp.id)}
              onEdit={() => {
                handleSelectExperience(exp.id);
                setTimeout(() => setMode("edit"), 0);
              }}
              onDuplicate={() => handleDuplicate(exp)}
              onDelete={() => handleDelete(exp.id)}
              onMoveToLibrary={(libId) => handleMoveToLibrary(exp.id, libId)}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
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
        {!middleCollapsed && (
          <div className="md:ml-[20vw] w-[340px] min-w-[280px] max-w-[400px] border-r border-border bg-surface flex-shrink-0 overflow-hidden">
            {listPanel}
          </div>
        )}
        <div
          className={[
            "flex-1 flex overflow-hidden bg-surface relative",
            middleCollapsed ? "md:ml-[20vw]" : "",
          ].join(" ")}
        >
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
            onUnsavedChange={() => {}}
            onUpdateImportance={handleUpdateImportance}
          />
        </div>
      </div>

      {/* Mobile */}
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
                  onUnsavedChange={() => {}}
                  onUpdateImportance={handleUpdateImportance}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
