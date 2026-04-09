"use client"

import { Input } from "@/components/ui/input"
import type { Block, TextBlockValue } from "@/types/archive"

interface TextBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: TextBlockValue) => void
}

export default function TextBlock({ block, readOnly, onChange }: TextBlockProps) {
  const val = block.value as TextBlockValue
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-text-secondary">{block.label}</span>
        <p className="text-body text-text-primary">{val.text || "—"}</p>
      </div>
    )
  }
  return (
    <Input
      label={block.label}
      placeholder={block.placeholder}
      value={val.text}
      onChange={e => onChange({ type: "text", text: e.target.value })}
      required={block.required}
    />
  )
}
