"use client"

import { useState } from "react"
import { X } from "lucide-react"
import type { Block, TagsBlockValue } from "@/types/archive"

interface TagsBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: TagsBlockValue) => void
}

export default function TagsBlock({ block, readOnly, onChange }: TagsBlockProps) {
  const val = block.value as TagsBlockValue
  const [input, setInput] = useState("")

  function addTag() {
    const trimmed = input.trim()
    if (!trimmed || val.tags.includes(trimmed)) return
    onChange({ type: "tags", tags: [...val.tags, trimmed] })
    setInput("")
  }

  function removeTag(tag: string) {
    onChange({ type: "tags", tags: val.tags.filter(t => t !== tag) })
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {val.tags.map(tag => (
              <span key={tag} className="bg-surface-brand text-brand-dark rounded-full px-2.5 py-0.5 text-caption font-medium">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-body text-text-disabled">—</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label text-text-primary">{block.label}</label>
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {val.tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-surface-brand text-brand-dark rounded-full pl-2.5 pr-1.5 py-0.5 text-caption font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 hover:bg-brand-light transition-colors"
              aria-label={`${tag} 삭제`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          placeholder="태그 입력 후 Enter"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
        />
        <button
          type="button"
          onClick={addTag}
          className="h-9 rounded-md border border-border bg-surface px-3 text-body-sm text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          추가
        </button>
      </div>
    </div>
  )
}
