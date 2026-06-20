"use client"

import ExperienceDetailV2 from "./ExperienceDetailV2"
import type { ExperienceV2, ImportanceLevel } from "@/types/archive"

// 입력(new/edit)은 별도 라우트(/archive/new·/archive/[id]/edit)로 분리됐다(FRT-74).
// FRT-75: 목록 뷰가 메인이 되면서 우측 패널은 카드 클릭 시에만 도킹되는 read-only
// 미리보기(peek) 전용이다. 빈 상태/선택 없음은 목록 영역이 담당하므로 이 패널은
// 선택된 경험이 있을 때만 마운트된다.
interface RightPanelV2Props {
  selectedExperience: ExperienceV2
  onDelete: (id: string) => void
  onDuplicate: (exp: ExperienceV2) => void
  onEdit: () => void
  onUpdateImportance?: (id: string, value: ImportanceLevel | undefined) => void
}

export default function RightPanelV2({
  selectedExperience,
  onDelete,
  onDuplicate,
  onEdit,
  onUpdateImportance,
}: RightPanelV2Props) {
  return (
    <div className="h-full overflow-y-auto bg-surface scrollbar-hide">
      <ExperienceDetailV2
        experience={selectedExperience}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onUpdateImportance={onUpdateImportance}
      />
    </div>
  )
}
