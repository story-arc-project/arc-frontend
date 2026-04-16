"use client"

import { useState } from "react"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
import type { Block, SingleSelectBlockValue } from "@/types/archive"

interface SingleSelectBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: SingleSelectBlockValue) => void
}

export default function SingleSelectBlock({ block, readOnly, onChange }: SingleSelectBlockProps) {
  const val = block.value as SingleSelectBlockValue
  const options = val.options.length > 0 ? val.options : (block.options ?? [])
  const [showEditor, setShowEditor] = useState(false)
  const [newOption, setNewOption] = useState("")
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")

  function addOption() {
    const trimmed = newOption.trim()
    if (!trimmed || options.includes(trimmed)) return
    onChange({ ...val, options: [...options, trimmed] })
    setNewOption("")
  }

  function removeOption(idx: number) {
    const removed = options[idx]
    const newOptions = options.filter((_, i) => i !== idx)
    onChange({
      ...val,
      options: newOptions,
      selected: val.selected === removed ? "" : val.selected,
    })
  }

  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditValue(options[idx])
  }

  function commitEdit() {
    if (editingIdx === null) return
    const trimmed = editValue.trim()
    if (!trimmed || (options.includes(trimmed) && trimmed !== options[editingIdx])) {
      setEditingIdx(null)
      return
    }
    const oldValue = options[editingIdx]
    const newOptions = options.map((opt, i) => (i === editingIdx ? trimmed : opt))
    onChange({
      ...val,
      options: newOptions,
      selected: val.selected === oldValue ? trimmed : val.selected,
    })
    setEditingIdx(null)
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.selected
          ? <p className="text-body text-text-primary">{val.selected}</p>
          : <p className="text-body text-text-disabled">—</p>}
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

      {/* Option editor toggle */}
      <button
        type="button"
        onClick={() => setShowEditor(s => !s)}
        className="self-start text-caption text-text-tertiary hover:text-text-secondary transition-colors mt-1"
      >
        {showEditor ? "옵션 편집 닫기" : "옵션 편집"}
      </button>

      {showEditor && (
        <div className="border border-border rounded-lg p-3 bg-surface-secondary">
          <div className="flex flex-col gap-1.5">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {editingIdx === idx ? (
                  <>
                    <input
                      type="text"
                      className="h-8 flex-1 min-w-0 rounded border border-brand bg-surface px-2 text-body-sm text-text-primary focus:outline-none"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitEdit()
                        if (e.key === "Escape") setEditingIdx(null)
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={commitEdit}
                      className="p-1 text-brand hover:text-brand-dark transition-colors"
                      aria-label="확인"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingIdx(null)}
                      className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                      aria-label="취소"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-body-sm text-text-primary truncate">{opt}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(idx)}
                      className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
                      aria-label="옵션 수정"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-1 text-text-tertiary hover:text-error transition-colors"
                      aria-label="옵션 삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new option */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              className="h-8 flex-1 min-w-0 rounded border border-border bg-surface px-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="새 옵션 추가..."
              value={newOption}
              onChange={e => setNewOption(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption() } }}
            />
            <button
              type="button"
              onClick={addOption}
              className="h-8 rounded border border-border bg-surface px-2 text-body-sm text-text-secondary hover:bg-surface-tertiary transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
