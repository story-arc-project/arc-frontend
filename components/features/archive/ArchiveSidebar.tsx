"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
} from "@dnd-kit/core";
import { Button, Dialog } from "@/components/ui";
import { FolderGroup } from "./FolderGroup";
import type { Folder, ExperienceWithFolder, Template } from "@/types/archive";
import { getExperienceTitle } from "@/lib/templates";

interface ArchiveSidebarProps {
  folders: Folder[];
  experiences: ExperienceWithFolder[];
  templates: Template[];
  selectedId: string | null;
  onSelectExperience: (id: string) => void;
  onNewExperience: () => void;
  onAddFolder: () => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveExperience: (expId: string, folderId: string) => void;
}

export function ArchiveSidebar({
  folders,
  experiences,
  templates,
  selectedId,
  onSelectExperience,
  onNewExperience,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveExperience,
}: ArchiveSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const dndContextId = useId()

  // Fix 1: MouseSensor requires intentional movement before drag activates;
  // TouchSensor uses delay so a tap never accidentally starts a drag.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  // Fix 3: disable text selection globally while a drag is in flight.
  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
    document.body.classList.add("dnd-dragging");
  }

  function stopDrag() {
    setActiveId(null);
    document.body.classList.remove("dnd-dragging");
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    stopDrag();
    if (!over) return;

    const expId = active.id as string;
    const targetFolderId = over.id as string;

    // Check if dropped on a folder (not on another item)
    const isFolder = folders.some((f) => f.id === targetFolderId);
    if (!isFolder) return;

    const exp = experiences.find((e) => e.id === expId);
    if (exp && exp.folderId !== targetFolderId) {
      onMoveExperience(expId, targetFolderId);
    }
  }

  return (
    <aside className="w-full md:w-[20vw] flex flex-col h-full overflow-hidden border-r border-border bg-surface-secondary">
      {/* Top: new experience button */}
      <div className="flex-shrink-0 px-2.5 pt-3 pb-2.5 border-b border-border">
        <button
          onClick={onNewExperience}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-brand text-body-large font-medium hover:bg-surface-brand transition-colors"
        >
          <span className="w-[14px] h-[14px] rounded-xs bg-brand text-white flex items-center justify-center flex-shrink-0">
            <Plus size={10} />
          </span>
          새 이력 추가
        </button>
      </div>

      {/* Middle: scrollable folder list */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={(_e: DragCancelEvent) => stopDrag()}
        id={dndContextId}
      >
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {folders.map((folder) => (
            <FolderGroup
              key={folder.id}
              folder={folder}
              experiences={experiences.filter((e) => e.folderId === folder.id)}
              templates={templates}
              selectedId={selectedId}
              onSelectExperience={onSelectExperience}
              onRenameFolder={onRenameFolder}
              onConfirmDeleteFolder={(id) => setShowDeleteConfirm(id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="px-4 py-2 rounded-md bg-surface border border-border shadow-md text-body-sm text-text-primary opacity-90 max-w-[200px] truncate">
              {getExperienceTitle(experiences.find((e) => e.id === activeId)?.raw_text ?? [])}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Bottom: add folder button */}
      <div className="flex-shrink-0 px-2.5 py-2.5 border-t border-border">
        <button
          onClick={onAddFolder}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-text-tertiary text-label hover:bg-surface-tertiary hover:text-text-secondary transition-colors"
        >
          <Plus size={12} />
          폴더 추가
        </button>
      </div>

      {/* Delete folder confirm modal */}
      <Dialog open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} ariaLabel="폴더를 삭제할까요?">
        <h3 className="text-title text-text-primary mb-2">폴더를 삭제할까요?</h3>
        <p className="text-body-sm text-text-secondary mb-6 leading-relaxed">
          안의 이력은 <strong>미분류</strong>로 이동돼요.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(null)}>
            취소
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (showDeleteConfirm) onDeleteFolder(showDeleteConfirm);
              setShowDeleteConfirm(null);
            }}
          >
            삭제
          </Button>
        </div>
      </Dialog>
    </aside>
  );
}
