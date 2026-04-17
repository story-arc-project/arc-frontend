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
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.text
          ? <p className="text-body text-text-primary">{val.text}</p>
          : <p className="text-body text-text-disabled">—</p>}
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
