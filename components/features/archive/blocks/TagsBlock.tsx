"use client"

import { useId, useState } from "react"
import { X } from "lucide-react"
import type { Block, TagsBlockValue } from "@/types/archive"
import { onEnterCommit } from "@/lib/utils/keyboard"
import { getQuickPickPreset } from "@/lib/constants/quick-pick-presets"
import QuickPickPanel from "./QuickPickPanel"

interface TagsBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: TagsBlockValue) => void
}

export default function TagsBlock({ block, readOnly, onChange }: TagsBlockProps) {
  const val = block.value as TagsBlockValue
  const [input, setInput] = useState("")
  const inputId = useId()
  /**
   * '＋ 빠른 선택' 픽커(FRT-130). 다중 선택 프리셋일 때만 그린다 — 모르는 id 나 단일 선택
   * 프리셋이면 픽커 없이 기존 자유 입력만 남아, 어느 쪽이든 태그를 못 넣게 되지는 않는다.
   */
  const preset = getQuickPickPreset(block.quickPick)
  const quickPick = preset?.mode === "multi" ? preset : null

  function addTag() {
    const trimmed = input.trim()
    if (!trimmed || val.tags.includes(trimmed)) return
    onChange({ type: "tags", tags: [...val.tags, trimmed] })
    setInput("")
  }

  function removeTag(tag: string) {
    onChange({ type: "tags", tags: val.tags.filter(t => t !== tag) })
  }

  /** 픽커에서 고른 항목은 토글이다 — 이미 있으면 빼고, 없으면 뒤에 붙인다(뱃지 × 와 같은 결과). */
  function toggleTag(tag: string) {
    if (val.tags.includes(tag)) removeTag(tag)
    else onChange({ type: "tags", tags: [...val.tags, tag] })
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
      <label htmlFor={inputId} className="text-field-label text-text-primary">{block.label}</label>
      {block.guide && <p className="text-caption text-text-tertiary">{block.guide}</p>}
      {/* FRT-301: 태그가 있을 때만 chip 줄을 렌더 — 빈 상태에서 공간을 차지하지 않는다. */}
      {val.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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
      )}
      {quickPick && (
        <QuickPickPanel preset={quickPick} selected={val.tags} onPick={toggleTag} />
      )}
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          placeholder="태그 입력 후 Enter"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onEnterCommit(addTag)}
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
