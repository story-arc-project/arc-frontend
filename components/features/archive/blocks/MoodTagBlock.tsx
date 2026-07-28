"use client"

import type { Block, ChecklistBlockValue } from "@/types/archive"

interface MoodTagBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: ChecklistBlockValue) => void
}

/**
 * 이모티콘 알약 태그 다중 선택(FRT-177). 값 shape 은 `checklist` 그대로이고
 * `block.variant === 'mood-tag'` 일 때 ChecklistBlock 대신 이 UI 로 렌더된다.
 * 옵션은 기획 확정본의 고정 프리셋이라 추가·삭제 UI 를 두지 않는다.
 */
export default function MoodTagBlock({ block, readOnly, onChange }: MoodTagBlockProps) {
  const val = block.value as ChecklistBlockValue

  function toggle(option: string) {
    const next = val.checked.includes(option)
      ? val.checked.filter(c => c !== option)
      : [...val.checked, option]
    onChange({ ...val, checked: next })
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.checked.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {val.checked.map(c => (
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
        {val.options.map(option => {
          const selected = val.checked.includes(option)
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
    </fieldset>
  )
}
