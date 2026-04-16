"use client"

import { Input } from "@/components/ui/input"
import type { Block, LinkBlockValue } from "@/types/archive"

interface LinkBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: LinkBlockValue) => void
}

export default function LinkBlock({ block, readOnly, onChange }: LinkBlockProps) {
  const val = block.value as LinkBlockValue

  function update(field: keyof Omit<LinkBlockValue, "type">, v: string) {
    onChange({ ...val, [field]: v })
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.url ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-body text-text-primary">{val.title || val.url}</span>
            {val.description && <span className="text-body-sm text-text-secondary">{val.description}</span>}
            {val.linkType && <span className="text-caption text-text-tertiary">{val.linkType}</span>}
          </div>
        ) : (
          <p className="text-body text-text-disabled">—</p>
        )}
      </div>
    )
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-label text-text-primary mb-1">{block.label}</legend>
      <Input
        placeholder="https://..."
        value={val.url}
        onChange={e => update("url", e.target.value)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          placeholder="제목 (선택)"
          value={val.title}
          onChange={e => update("title", e.target.value)}
        />
        <Input
          placeholder="유형 (데모/문서/기사 등)"
          value={val.linkType}
          onChange={e => update("linkType", e.target.value)}
        />
      </div>
      <Input
        placeholder="설명 (선택)"
        value={val.description}
        onChange={e => update("description", e.target.value)}
      />
    </fieldset>
  )
}
