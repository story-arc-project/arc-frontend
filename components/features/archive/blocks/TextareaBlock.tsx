"use client"

import { Textarea } from "@/components/ui/textarea"
import type { Block, TextareaBlockValue } from "@/types/archive"

interface TextareaBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: TextareaBlockValue) => void
}

export default function TextareaBlock({ block, readOnly, onChange }: TextareaBlockProps) {
  const val = block.value as TextareaBlockValue
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.text
          ? <p className="text-body text-text-primary whitespace-pre-wrap leading-relaxed">{val.text}</p>
          : <p className="text-body text-text-disabled">—</p>}
      </div>
    )
  }
  return (
    <Textarea
      label={block.label}
      placeholder={block.placeholder}
      value={val.text}
      onChange={e => onChange({ type: "textarea", text: e.target.value })}
      required={block.required}
    />
  )
}
