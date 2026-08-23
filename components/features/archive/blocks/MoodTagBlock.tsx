"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import type { Block, ChecklistBlockValue } from "@/types/archive"
import { onEnterCommit } from "@/lib/utils/keyboard"

interface MoodTagBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: ChecklistBlockValue) => void
}

/**
 * 화면에 그릴 태그 목록. 저장값의 options 를 우선하되,
 * - options 가 비었거나 없으면 템플릿 프리셋(block.options)으로 복원하고,
 * - 프리셋에 없는데 checked 에만 남은 값(프리셋 개편·손상값)도 뒤에 붙인다.
 * 후자가 없으면 선택돼 있는데 화면에 안 보여 **해제할 방법이 사라진다**.
 * BlockRenderer 가 폴백 여부를 판정할 때도 같은 계산을 써야 판정이 갈리지 않는다.
 */
export function moodTagOptions(block: Block): string[] {
  const val = block.value as ChecklistBlockValue | undefined
  const saved = Array.isArray(val?.options) ? val.options : []
  const checked = Array.isArray(val?.checked) ? val.checked : []
  const base = saved.length > 0 ? saved : block.options ?? []
  return [...base, ...checked.filter(c => !base.includes(c))]
}

/**
 * 이모티콘 알약 태그 다중 선택(FRT-177). 값 shape 은 `checklist` 그대로이고
 * `block.variant === 'mood-tag'` 일 때 ChecklistBlock 대신 이 UI 로 렌더된다.
 * 옵션은 기획 확정본의 고정 프리셋이라 추가·삭제 UI 를 두지 않는다.
 */
export default function MoodTagBlock({ block, readOnly, onChange }: MoodTagBlockProps) {
  const val = block.value as ChecklistBlockValue
  const options = moodTagOptions(block)
  const checked = Array.isArray(val?.checked) ? val.checked : []
  const [newTag, setNewTag] = useState("")

  function toggle(option: string) {
    const next = checked.includes(option)
      ? checked.filter(c => c !== option)
      : [...checked, option]
    // 복원한 프리셋을 그대로 저장한다 — 다음 로드에서도 같은 목록이 보이도록.
    onChange({ type: "checklist", options, checked: next })
  }

  /**
   * 직접 추가 (FRT-320, `allowCustomTag` opt-in). `options`(프리셋)는 건드리지 않고
   * `checked` 에만 넣는다 — 다음 렌더는 `moodTagOptions()` 의 기존 "checked 에만 남은 값도
   * 뒤에 붙인다" 폴백이 선택된 pill 로 그려 준다.
   */
  function addCustomTag() {
    const trimmed = newTag.trim()
    if (!trimmed || checked.includes(trimmed)) return
    onChange({ type: "checklist", options, checked: [...checked, trimmed] })
    setNewTag("")
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {checked.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {checked.map(c => (
              <span
                key={c}
                className="bg-surface-brand text-brand-dark rounded-full px-2.5 py-0.5 text-caption font-medium"
              >
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
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-field-label text-text-primary">{block.label}</legend>
      {block.guide && <p className="text-caption text-text-tertiary mb-1">{block.guide}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const selected = checked.includes(option)
          return (
            <label
              key={option}
              className={[
                // relative: sr-only 체크박스(absolute)가 가장 가까운 positioned 조상을 기준으로
                // 잡히게 해 바깥 컨테이너로 새어나가지 않게 한다.
                "relative cursor-pointer rounded-full border px-3 py-1.5 text-body-sm transition-colors",
                selected
                  ? "border-brand bg-surface-brand text-brand-dark font-semibold"
                  : "border-border bg-surface text-text-secondary hover:border-brand",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected}
                onChange={() => toggle(option)}
              />
              {option}
            </label>
          )
        })}
      </div>
      {block.allowCustomTag && (
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            className="h-9 flex-1 min-w-0 rounded-full border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            placeholder="나만의 키워드 직접 추가..."
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={onEnterCommit(addCustomTag)}
          />
          <button
            type="button"
            onClick={addCustomTag}
            aria-label="직접 추가"
            className="h-9 rounded-full border border-border bg-surface px-3 text-body-sm text-text-secondary hover:bg-surface-tertiary transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </fieldset>
  )
}
