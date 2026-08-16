"use client"

import type { Block, SingleSelectBlockValue } from "@/types/archive"

interface BinaryChoiceBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: SingleSelectBlockValue) => void
}

/**
 * 화면에 그릴 [왼쪽, 오른쪽] 선택지. 저장값의 options 를 우선하되 비어 있으면 템플릿
 * 프리셋(block.options)으로 복원하고, **정확히 2개일 때만** 반환한다 — 사용자가 옵션 편집으로
 * 셋 이상을 만든 저장값은 두 카드로 그릴 수 없으므로 undefined 를 돌려 SingleSelectBlock
 * 폴백을 태운다. BlockRenderer 가 폴백 여부를 판정할 때도 같은 계산을 써야 판정이 갈리지 않는다.
 */
export function binaryChoiceOptions(block: Block): [string, string] | undefined {
  const val = block.value as SingleSelectBlockValue | undefined
  const saved = Array.isArray(val?.options) ? val.options : []
  const base = saved.length > 0 ? saved : block.options ?? []
  return base.length === 2 ? [base[0], base[1]] : undefined
}

/**
 * 양자택일 카드(FRT-320, '나는 누구인가?' ③ 업무 성향). 값 shape 은 `single-select` 그대로이고
 * `block.variant === 'binary-choice'` 일 때 SingleSelectBlock(드롭다운) 대신 이 UI 로 렌더된다.
 * 전 필드가 선택인 유형이라 이미 선택된 쪽을 다시 클릭하면 해제된다 — "둘 다 아니다"로
 * 되돌릴 길이 없으면 한 번 고른 순간 답이 강제된다.
 */
export default function BinaryChoiceBlock({ block, readOnly, onChange }: BinaryChoiceBlockProps) {
  const val = block.value as SingleSelectBlockValue
  const options = binaryChoiceOptions(block)
  if (!options) return null

  function choose(option: string) {
    if (!options) return
    // 복원한 프리셋을 그대로 저장한다 — 다음 로드에서도 같은 두 카드가 보이도록(mood-tag 규약).
    onChange({ type: "single-select", options, selected: val.selected === option ? "" : option })
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
      <span className="text-field-label text-text-primary">{block.label}</span>
      {block.guide && <p className="text-caption text-text-tertiary">{block.guide}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(option => {
          const selected = val.selected === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(option)}
              className={[
                "min-h-12 rounded-md border px-4 py-3 text-body-sm text-left transition-colors",
                selected
                  ? "border-brand bg-surface-brand text-brand-dark font-semibold"
                  : "border-border bg-surface text-text-secondary hover:border-brand",
              ].join(" ")}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
