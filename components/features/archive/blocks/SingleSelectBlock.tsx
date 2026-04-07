"use client"

import type { Block, SingleSelectBlockValue } from "@/types/archive"

interface SingleSelectBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: SingleSelectBlockValue) => void
}

export default function SingleSelectBlock({ block, readOnly, onChange }: SingleSelectBlockProps) {
  const val = block.value as SingleSelectBlockValue
  const options = val.options.length > 0 ? val.options : (block.options ?? [])

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-text-secondary">{block.label}</span>
        <p className="text-body text-text-primary">{val.selected || "—"}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label text-text-primary">{block.label}</label>
      <select
        value={val.selected}
        onChange={e => onChange({ ...val, selected: e.target.value })}
        className={[
          "h-12 w-full rounded-md border border-border bg-surface px-4",
          "text-body text-text-primary",
          "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
          "transition-colors",
        ].join(" ")}
        required={block.required}
      >
        <option value="">선택해주세요</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}
