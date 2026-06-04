"use client"

import { useState } from "react"
import { X } from "lucide-react"
import type { Block, ChecklistBlockValue } from "@/types/archive"

interface ChecklistBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: ChecklistBlockValue) => void
}

export default function ChecklistBlock({ block, readOnly, onChange }: ChecklistBlockProps) {
  const val = block.value as ChecklistBlockValue
  const [newOption, setNewOption] = useState("")

  function toggle(option: string) {
    const next = val.checked.includes(option)
      ? val.checked.filter(c => c !== option)
      : [...val.checked, option]
    onChange({ ...val, checked: next })
  }

  function removeOption(option: string) {
    onChange({
      ...val,
      options: val.options.filter(o => o !== option),
      checked: val.checked.filter(c => c !== option),
    })
  }

  function addOption() {
    const trimmed = newOption.trim()
    if (!trimmed || val.options.includes(trimmed)) return
    onChange({ ...val, options: [...val.options, trimmed] })
    setNewOption("")
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.checked.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {val.checked.map(c => (
              <span key={c} className="bg-surface-tertiary text-text-secondary rounded-full px-2.5 py-0.5 text-caption">
                {c}
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
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label text-text-primary mb-1">{block.label}</legend>
      <div className="flex flex-wrap gap-2">
        {val.options.map(option => (
          <label
            key={option}
            className={[
              "flex items-center gap-2 cursor-pointer rounded-md border pl-3 pr-1.5 py-2 text-body transition-colors",
              val.checked.includes(option)
                ? "border-brand bg-surface-brand text-text-primary"
                : "border-border bg-surface text-text-secondary hover:border-border-strong",
            ].join(" ")}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={val.checked.includes(option)}
              onChange={() => toggle(option)}
            />
            {option}
            <button
              type="button"
              onClick={e => { e.preventDefault(); e.stopPropagation(); removeOption(option) }}
              className="rounded-full p-0.5 hover:bg-brand-light transition-colors"
              aria-label={`${option} 삭제`}
            >
              <X size={12} />
            </button>
          </label>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          placeholder="항목 추가..."
          value={newOption}
          onChange={e => setNewOption(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption() } }}
        />
        <button
          type="button"
          onClick={addOption}
          className="h-9 rounded-md border border-border bg-surface px-3 text-body-sm text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          추가
        </button>
      </div>
    </fieldset>
  )
}
