"use client"

import { Paperclip } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Block, FileBlockValue } from "@/types/archive"

interface FileBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: FileBlockValue) => void
}

export default function FileBlock({ block, readOnly, onChange }: FileBlockProps) {
  const val = block.value as FileBlockValue

  function update(field: keyof Omit<FileBlockValue, "type">, v: string) {
    onChange({ ...val, [field]: v })
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.fileName ? (
          <div className="flex items-center gap-2">
            <Paperclip size={14} className="text-text-tertiary" />
            <span className="text-body text-text-primary">{val.fileName}</span>
            {val.evidenceType && (
              <span className="bg-surface-tertiary text-text-secondary rounded-full px-2 py-0.5 text-caption">{val.evidenceType}</span>
            )}
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
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 h-12 rounded-md border border-dashed border-border bg-surface px-4 cursor-pointer hover:border-brand transition-colors flex-1">
          <Paperclip size={16} className="text-text-tertiary" />
          <span className="text-body-sm text-text-tertiary">
            {val.fileName || "파일 선택..."}
          </span>
          <input
            type="file"
            className="sr-only"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) update("fileName", file.name)
            }}
          />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          placeholder="설명 (선택)"
          value={val.description}
          onChange={e => update("description", e.target.value)}
        />
        <Input
          placeholder="증빙 유형 (성적표/상장 등)"
          value={val.evidenceType}
          onChange={e => update("evidenceType", e.target.value)}
        />
      </div>
    </fieldset>
  )
}
