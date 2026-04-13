"use client"

import ExperienceFormV2 from "./ExperienceFormV2"
import ExperienceDetailV2 from "./ExperienceDetailV2"
import type { ExperienceV2, ImportanceLevel } from "@/types/archive"
import type { UsePresetsReturn } from "@/hooks/usePresets"

export type ArchiveModeV2 = "empty" | "new" | "detail" | "edit"

interface RightPanelV2Props {
  mode: ArchiveModeV2
  selectedExperience: ExperienceV2 | null
  presetsHook: UsePresetsReturn
  onNewExperience: () => void
  onSave: (exp: ExperienceV2) => void
  onDelete: (id: string) => void
  onDuplicate: (exp: ExperienceV2) => void
  onCancel: () => void
  onEdit: () => void
  onUnsavedChange: (hasUnsaved: boolean) => void
  onUpdateImportance?: (id: string, value: ImportanceLevel | undefined) => void
}

export default function RightPanelV2({
  mode,
  selectedExperience,
  presetsHook,
  onNewExperience,
  onSave,
  onDelete,
  onDuplicate,
  onCancel,
  onEdit,
  onUnsavedChange,
  onUpdateImportance,
}: RightPanelV2Props) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-surface scrollbar-hide">
      {mode === "empty" && (
        <EmptyState onNewExperience={onNewExperience} />
      )}

      {mode === "new" && (
        <ExperienceFormV2
          mode="new"
          presetsHook={presetsHook}
          onSave={onSave}
          onCancel={onCancel}
          onUnsavedChange={onUnsavedChange}
        />
      )}

      {mode === "detail" && selectedExperience && (
        <ExperienceDetailV2
          experience={selectedExperience}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onUpdateImportance={onUpdateImportance}
        />
      )}

      {mode === "edit" && selectedExperience && (
        <ExperienceFormV2
          mode="edit"
          initialExperience={selectedExperience}
          presetsHook={presetsHook}
          onSave={onSave}
          onCancel={onCancel}
          onUnsavedChange={onUnsavedChange}
        />
      )}
    </div>
  )
}

function EmptyState({ onNewExperience }: { onNewExperience: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-text-tertiary px-4">
      <div className="w-12 h-12 rounded-xl bg-surface-secondary flex items-center justify-center text-2xl mb-1">
        📋
      </div>
      <p className="text-heading-3 text-text-secondary">기록을 시작해보세요</p>
      <p className="text-body-lg text-text-tertiary text-center leading-relaxed">
        좌측에서 경험을 선택하거나{" "}
        <button
          onClick={onNewExperience}
          className="text-brand font-medium hover:text-brand-dark transition-colors"
        >
          새 경험 추가
        </button>
        를 눌러보세요
      </p>
    </div>
  )
}
