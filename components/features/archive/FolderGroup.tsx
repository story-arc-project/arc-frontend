"use client";

import { useState } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ExperienceItem } from "./ExperienceItem";
import { FolderContextMenu } from "./FolderContextMenu";
import type { Folder, ExperienceWithFolder, Template } from "@/types/archive";

interface FolderGroupProps {
  folder: Folder;
  experiences: ExperienceWithFolder[];
  templates: Template[];
  selectedId: string | null;
  onSelectExperience: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onConfirmDeleteFolder: (id: string) => void;
}

export function FolderGroup({
  folder,
  experiences,
  templates,
  selectedId,
  onSelectExperience,
  onRenameFolder,
  onConfirmDeleteFolder,
}: FolderGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [contextMenu, setContextMenu] = useState<DOMRect | null>(null);

  const { setNodeRef, isOver } = useDroppable({ id: folder.id });

  function startRename() {
    setRenameValue(folder.name);
    setIsRenaming(true);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      onRenameFolder(folder.id, trimmed);
    } else {
      setRenameValue(folder.name);
    }
    setIsRenaming(false);
  }

  function cancelRename() {
    setRenameValue(folder.name);
    setIsRenaming(false);
  }

  function openContextMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setContextMenu(e.currentTarget.getBoundingClientRect());
  }

  return (
    <div
      ref={setNodeRef}
      className={[
        "rounded-md mx-1 transition-colors",
        isOver ? "ring-1 ring-brand bg-surface-brand" : "",
      ].join(" ")}
    >
      {/* Folder header */}
      <div className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-surface-tertiary cursor-pointer select-none group">
        <div
          className="flex items-center gap-1.5 min-w-0 flex-1"
          onClick={() => setIsOpen((o) => !o)}
        >
          <ChevronRight
            size={12}
            className={[
              "text-text-tertiary transition-transform duration-150 flex-shrink-0",
              isOpen ? "rotate-90" : "",
            ].join(" ")}
          />

          {isRenaming ? (
            <input
              autoFocus
              aria-label="폴더 이름 변경"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") cancelRename();
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-label font-semibold text-text-secondary bg-transparent border-b border-brand outline-none w-full"
            />
          ) : (
            <span
              onDoubleClick={() => !folder.isSystem && startRename()}
              className="text-label font-semibold text-text-secondary truncate"
            >
              {folder.name}
            </span>
          )}

          <span className="text-caption text-text-disabled flex-shrink-0">
            {experiences.length}
          </span>
        </div>
        <button
          onClick={openContextMenu}
          aria-label="폴더 옵션"
          className="opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-text-tertiary hover:bg-border hover:text-text-secondary transition-all flex-shrink-0 -mr-2"
        >
          <MoreHorizontal size={13} />
        </button>
        
      </div>

      {/* Items list — CSS grid transition for smooth collapse without layout thrash */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <SortableContext
            items={experiences.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            {experiences.map((exp) => (
              <ExperienceItem
                key={exp.id}
                experience={exp}
                template={templates.find((t) => t.id === exp.templates_id)}
                isActive={selectedId === exp.id}
                onClick={onSelectExperience}
              />
            ))}
          </SortableContext>

          {experiences.length === 0 && (
            <p className="pl-8 pr-3 py-2 text-caption text-text-disabled">
              비어 있어요
            </p>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FolderContextMenu
          anchorRect={contextMenu}
          onRename={startRename}
          onDelete={() => onConfirmDeleteFolder(folder.id)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
