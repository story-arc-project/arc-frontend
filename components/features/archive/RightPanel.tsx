"use client";

import { ExperienceForm } from "./ExperienceForm";
import { ExperienceDetail } from "./ExperienceDetail";
import type {
  Folder,
  Template,
  ExperienceWithFolder,
} from "@/types/archive";
import type { ArchiveMode } from "@/app/(main)/archive/page";

interface RightPanelProps {
  mode: ArchiveMode;
  selectedId: string | null;
  selectedExperience: ExperienceWithFolder | null;
  selectedTemplate: Template | null;
  folders: Folder[];
  templates: Template[];
  onNewExperience: () => void;
  onSave: (exp: ExperienceWithFolder) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
  onEdit: () => void;
  onUnsavedChange: (hasUnsaved: boolean) => void;
}

export function RightPanel({
  mode,
  selectedExperience,
  selectedTemplate,
  folders,
  templates,
  onNewExperience,
  onSave,
  onDelete,
  onCancel,
  onEdit,
  onUnsavedChange,
}: RightPanelProps) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-surface">
      {mode === "empty" && (
        <EmptyState onNewExperience={onNewExperience} />
      )}

      {mode === "new" && (
        <ExperienceForm
          mode="new"
          folders={folders}
          templates={templates}
          onSave={onSave}
          onCancel={onCancel}
          onUnsavedChange={onUnsavedChange}
        />
      )}

      {(mode === "detail" || mode === "edit") && selectedExperience && (
        <ExperienceDetail
          experience={selectedExperience}
          template={selectedTemplate ?? undefined}
          isEditing={mode === "edit"}
          folders={folders}
          templates={templates}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
          onDelete={onDelete}
          onUnsavedChange={onUnsavedChange}
        />
      )}
    </div>
  );
}

function EmptyState({ onNewExperience }: { onNewExperience: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-text-tertiary px-4">
      <div className="w-12 h-12 rounded-xl bg-surface-secondary flex items-center justify-center text-2xl mb-1">
        📋
      </div>
      <p className="text-heading-3 text-text-secondary">기록을 시작해보세요</p>
      <p className="text-body-lg text-text-tertiary text-center leading-relaxed">
        좌측에서 이력을 선택하거나{" "}
        <button
          onClick={onNewExperience}
          className="text-brand font-medium hover:text-brand-dark transition-colors"
        >
          새 이력 추가
        </button>
        를 눌러보세요
      </p>
    </div>
  );
}
