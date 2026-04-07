"use client"

import {
  Type,
  AlignLeft,
  CheckSquare,
  List,
  Calendar,
  CalendarRange,
  Tag,
  Link2,
  Paperclip,
  Rows3,
  Table2,
} from "lucide-react"
import type { BlockType } from "@/types/archive"

interface BlockTypePickerProps {
  onSelect: (type: BlockType) => void
  onClose: () => void
}

const BLOCK_OPTIONS: { type: BlockType; label: string; icon: typeof Type }[] = [
  { type: "text", label: "텍스트 (짧은)", icon: Type },
  { type: "textarea", label: "텍스트 (긴)", icon: AlignLeft },
  { type: "checklist", label: "체크리스트", icon: CheckSquare },
  { type: "single-select", label: "단일 선택", icon: List },
  { type: "date", label: "날짜", icon: Calendar },
  { type: "period", label: "기간", icon: CalendarRange },
  { type: "tags", label: "태그", icon: Tag },
  { type: "link", label: "링크", icon: Link2 },
  { type: "file", label: "파일 첨부", icon: Paperclip },
  { type: "repeatable-cell", label: "반복 셀 (로그형)", icon: Rows3 },
  { type: "table", label: "표 (그리드)", icon: Table2 },
]

export default function BlockTypePicker({ onSelect, onClose }: BlockTypePickerProps) {
  return (
    <div
      className="absolute z-20 mt-1 w-64 bg-surface border border-border rounded-lg shadow-lg py-1"
      role="listbox"
    >
      {BLOCK_OPTIONS.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => { onSelect(type); onClose() }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-body-sm text-text-primary hover:bg-surface-secondary transition-colors text-left"
        >
          <Icon size={16} className="text-text-tertiary shrink-0" />
          {label}
        </button>
      ))}
    </div>
  )
}
