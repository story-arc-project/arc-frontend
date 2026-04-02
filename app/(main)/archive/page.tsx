"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { ArchiveSidebar } from "@/components/features/archive/ArchiveSidebar";
import { RightPanel } from "@/components/features/archive/RightPanel";
import type { Folder, ExperienceWithFolder, Template } from "@/types/archive";
import { SYSTEM_TEMPLATES, getExperienceTitle, getExperiencePeriod } from "@/lib/templates";
import { MOCK_FOLDERS, MOCK_EXPERIENCES } from "@/lib/mock-data";

export type ArchiveMode = "empty" | "new" | "detail" | "edit";
type MobileView = "sidebar" | "panel";

function templateForExperience(
  exp: ExperienceWithFolder,
  templates: Template[]
): Template | undefined {
  return templates.find((t) => t.id === exp.templates_id);
}

export default function ArchivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<ArchiveMode>("empty");
  const [mobileView, setMobileView] = useState<MobileView>("sidebar");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null | undefined>(undefined);
  const [showGuardModal, setShowGuardModal] = useState(false);

  const [folders, setFolders] = useState<Folder[]>(MOCK_FOLDERS);
  const [experiences, setExperiences] = useState<ExperienceWithFolder[]>(MOCK_EXPERIENCES);
  const [templates] = useState<Template[]>(SYSTEM_TEMPLATES);

  // Sync ?id= on first mount
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && experiences.find((e) => e.id === id)) {
      setSelectedId(id);
      setMode("detail");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guard helper ────────────────────────────────────────────────────────
  function guardedNavigate(action: () => void) {
    if (hasUnsaved) {
      // store action target in pendingSelectId as a signal
      setShowGuardModal(true);
      return false;
    }
    action();
    return true;
  }

  // ── Selection ───────────────────────────────────────────────────────────
  const handleSelectExperience = useCallback(
    (id: string) => {
      if (hasUnsaved) {
        setPendingSelectId(id);
        setShowGuardModal(true);
        return;
      }
      setSelectedId(id);
      setMode("detail");
      setMobileView("panel");
      router.push(`/archive?id=${id}`, { scroll: false });
    },
    [hasUnsaved, router]
  );

  const handleNewExperience = useCallback(() => {
    if (hasUnsaved) {
      setPendingSelectId(null); // null = "new experience"
      setShowGuardModal(true);
      return;
    }
    setSelectedId(null);
    setMode("new");
    setMobileView("panel");
    router.push("/archive", { scroll: false });
  }, [hasUnsaved, router]);

  // ── CRUD ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(
    (exp: ExperienceWithFolder) => {
      setExperiences((prev) => {
        const exists = prev.some((e) => e.id === exp.id);
        return exists ? prev.map((e) => (e.id === exp.id ? exp : e)) : [...prev, exp];
      });
      setSelectedId(exp.id);
      setMode("detail");
      setHasUnsaved(false);
      router.push(`/archive?id=${exp.id}`, { scroll: false });
    },
    [router]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setExperiences((prev) => prev.filter((e) => e.id !== id));
      setSelectedId(null);
      setMode("empty");
      setMobileView("sidebar");
      setHasUnsaved(false);
      router.push("/archive", { scroll: false });
    },
    [router]
  );

  const handleCancel = useCallback(() => {
    setHasUnsaved(false);
    if (selectedId) {
      setMode("detail");
    } else {
      setMode("empty");
      setMobileView("sidebar");
    }
  }, [selectedId]);

  // ── Folder management ───────────────────────────────────────────────────
  const handleAddFolder = useCallback(() => {
    const idx = folders.filter((f) => !f.isSystem).length + 1;
    setFolders((prev) => [
      ...prev,
      { id: `folder-${Date.now()}`, name: `폴더 ${idx}`, isSystem: false },
    ]);
  }, [folders]);

  const handleRenameFolder = useCallback((id: string, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }, []);

  const handleDeleteFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setExperiences((prev) =>
      prev.map((e) => (e.folderId === id ? { ...e, folderId: "unclassified" } : e))
    );
  }, []);

  const handleMoveExperience = useCallback((expId: string, folderId: string) => {
    setExperiences((prev) => prev.map((e) => (e.id === expId ? { ...e, folderId } : e)));
  }, []);

  // ── Unsaved guard ───────────────────────────────────────────────────────
  const confirmDiscard = useCallback(() => {
    setShowGuardModal(false);
    setHasUnsaved(false);
    if (pendingSelectId === null) {
      // "null" means navigate to new
      setSelectedId(null);
      setMode("new");
      setMobileView("panel");
      router.push("/archive", { scroll: false });
    } else if (pendingSelectId !== undefined) {
      setSelectedId(pendingSelectId);
      setMode("detail");
      setMobileView("panel");
      router.push(`/archive?id=${pendingSelectId}`, { scroll: false });
    }
    setPendingSelectId(undefined);
  }, [pendingSelectId, router]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const selectedExperience = experiences.find((e) => e.id === selectedId) ?? null;
  const selectedTemplate = selectedExperience
    ? templateForExperience(selectedExperience, templates)
    : null;

  const sharedProps = {
    folders,
    templates,
    experiences,
    selectedId,
    mode,
    selectedExperience,
    selectedTemplate: selectedTemplate ?? null,
    onSelectExperience: handleSelectExperience,
    onNewExperience: handleNewExperience,
    onSave: handleSave,
    onDelete: handleDelete,
    onCancel: handleCancel,
    onEdit: () => setMode("edit"),
    onUnsavedChange: setHasUnsaved,
    onMoveExperience: handleMoveExperience,
  };

  return (
    <>
      {/* ── Desktop layout (lg+) ─────────────────────────────────────── */}
      <div className="hidden lg:flex h-[calc(100dvh-var(--gnb-h))] overflow-hidden">
        <ArchiveSidebar
          {...sharedProps}
          onAddFolder={handleAddFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />
        <RightPanel {...sharedProps} />
      </div>

      {/* ── Mobile layout (<lg) ──────────────────────────────────────── */}
      <div className="lg:hidden relative h-[calc(100dvh-var(--gnb-h))] overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          {mobileView === "sidebar" ? (
            <motion.div
              key="sidebar"
              className="absolute inset-0"
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <ArchiveSidebar
                {...sharedProps}
                onAddFolder={handleAddFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
              />
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
              {/* Mobile back button */}
              <div className="flex-shrink-0 flex items-center px-4 h-11 border-b border-border bg-surface">
                <button
                  onClick={() => setMobileView("sidebar")}
                  aria-label="목록으로 돌아가기"
                  className="flex items-center gap-1.5 text-label text-brand hover:text-brand-dark transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>목록으로</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <RightPanel {...sharedProps} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Unsaved changes guard modal ───────────────────────────────── */}
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
  );
}
