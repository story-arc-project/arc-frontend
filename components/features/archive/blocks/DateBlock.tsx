"use client"

import { DatePicker } from "@/components/ui/date-picker"
import type { Block, DateBlockValue } from "@/types/archive"

interface DateBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: DateBlockValue) => void
}

export default function DateBlock({ block, readOnly, onChange }: DateBlockProps) {
  const val = block.value as DateBlockValue
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-text-secondary">{block.label}</span>
        <p className="text-body text-text-primary">{val.date || "—"}</p>
      </div>
    )
  }
  return (
    <DatePicker
      label={block.label}
      mode="date"
      value={val.date}
      onChange={e => onChange({ type: "date", date: e.target.value })}
      required={block.required}
    />
  )
}
