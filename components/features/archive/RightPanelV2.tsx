"use client"

import { Button } from "@/components/ui/button"
import ExperienceDetailV2 from "./ExperienceDetailV2"
import type { ExperienceV2, ImportanceLevel } from "@/types/archive"

// 입력(new/edit)은 별도 라우트(/archive/new·/archive/[id]/edit)로 분리됐다(FRT-74).
// 목록 페이지의 우측 패널은 빈 상태 / 상세 보기만 담당한다.
export type ArchiveModeV2 = "empty" | "detail"

interface RightPanelV2Props {
  mode: ArchiveModeV2
  selectedExperience: ExperienceV2 | null
  onNewExperience: () => void
  onDelete: (id: string) => void
  onDuplicate: (exp: ExperienceV2) => void
  onEdit: () => void
  onUpdateImportance?: (id: string, value: ImportanceLevel | undefined) => void
}

export default function RightPanelV2({
  mode,
  selectedExperience,
  onNewExperience,
  onDelete,
  onDuplicate,
  onEdit,
  onUpdateImportance,
}: RightPanelV2Props) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-surface scrollbar-hide">
      {mode === "empty" && (
        <EmptyState onNewExperience={onNewExperience} />
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
    </div>
  )
}

function EmptyState({ onNewExperience }: { onNewExperience: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center text-text-tertiary">
      <div className="w-12 h-12 rounded-xl bg-surface-secondary flex items-center justify-center text-2xl mb-1">
        📋
      </div>
      <p className="text-heading-3 text-text-secondary">기록을 시작해보세요</p>
      <p className="text-body-lg text-text-tertiary leading-relaxed">
        새 경험을 추가해 기록을 남겨보세요
      </p>
      <Button variant="primary" size="lg" onClick={onNewExperience} className="mt-2">
        새 경험 추가하기
      </Button>
    </div>
  )
}
