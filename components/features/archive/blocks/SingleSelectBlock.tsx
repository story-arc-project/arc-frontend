"use client"

import { useId, useState } from "react"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
import { RequiredDot } from "@/components/ui/required-dot"
import type { Block, SingleSelectBlockValue } from "@/types/archive"
import { isImeComposing, onEnterCommit } from "@/lib/utils/keyboard"

interface SingleSelectBlockProps {
  block: Block
  readOnly?: boolean
  /**
   * 인라인 옵션 편집 노출 (FRT-322). **미지정이면 닫힘** — 템플릿이 소유한 확정본 선택지를
   * 사용자가 고치면 기획이 정한 목록이 계정마다 갈린다.
   *
   * 판정을 새로 만들지 않고 `BlockList` 의 `editEnabled`(= `allowEdit ?? allowAdd`, 곧
   * "커스텀 블록인가")를 그대로 받는다 — 같은 플래그가 바깥 연필(블록 편집 모달)도 가르므로
   * 편집 경로가 한쪽만 열린 채 남지 않는다.
   */
  allowOptionEdit?: boolean
  onChange: (value: SingleSelectBlockValue) => void
}

export default function SingleSelectBlock({
  block,
  readOnly,
  allowOptionEdit,
  onChange,
}: SingleSelectBlockProps) {
  const val = block.value as SingleSelectBlockValue
  const saved = Array.isArray(val.options) ? val.options : []
  const preset = block.options ?? []
  /**
   * 목록의 **소유권**은 편집 권한과 같은 축이다 (FRT-322).
   *  · 커스텀 블록(allowOptionEdit): 사용자가 목록을 소유한다 — 저장값을 우선한다. 프리셋을
   *    되살리면 방금 지운 옵션이 다음 렌더에 부활한다(FRT-158 이 그 버그였다).
   *  · 템플릿 블록: 확정본이 목록을 소유한다 — 프리셋을 우선한다. 편집 UI 를 없앴으므로
   *    과거 인라인 편집으로 프리셋을 지워 저장한 값은 여기서만 복구될 수 있다.
   */
  const base = allowOptionEdit
    ? (saved.length > 0 ? saved : preset)
    : (preset.length > 0 ? preset : saved)
  /**
   * 어느 쪽이든 저장된 **값**(selected)은 목록에서 빠지지 않는다 — 빠지면 값이 저장돼 있는데
   * 화면에 안 보여 바꿀 수도 지울 수도 없다(moodTagOptions 의 checked 보존과 같은 규약).
   * ⚠️ 표시 전용 보정이다. onChange 로 이 목록을 굳혀 내보내지 않는다 — 굳히면 다음 확정본
   * 개편이 그 필드에 닿지 못한다.
   */
  const options = val.selected && !base.includes(val.selected) ? [...base, val.selected] : base
  const [showEditor, setShowEditor] = useState(false)
  const [newOption, setNewOption] = useState("")
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const selectId = useId()

  function addOption() {
    const trimmed = newOption.trim()
    if (!trimmed || options.includes(trimmed)) return
    onChange({ ...val, options: [...options, trimmed] })
    setNewOption("")
  }

  function removeOption(idx: number) {
    // 마지막 하나는 남긴다(FRT-158). 옵션이 0개가 되면 위 폴백이 `block.options`(생성 시점의
    // 템플릿 프리셋, 이후 갱신되지 않는 필드)로 되돌아가 방금 지운 목록이 그대로 되살아난다.
    // 게다가 required 드롭다운은 고를 값이 사라져 저장도 진행도도 영원히 막힌다.
    // 아래 버튼의 disabled 와 같은 조건인 이중 방어다 — 다른 호출처가 생겨도 0개가 되지 않는다.
    if (options.length <= 1) return
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
      <label htmlFor={selectId} className="text-field-label text-text-primary">
        {block.label}
        {block.required && <RequiredDot />}
      </label>
      {block.guide && <p className="text-caption text-text-tertiary">{block.guide}</p>}
      <select
        id={selectId}
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

      {/* Option editor toggle — 커스텀 블록에만 붙는다(FRT-322) */}
      {allowOptionEdit && (
        <button
          type="button"
          onClick={() => setShowEditor(s => !s)}
          className="self-start text-caption text-text-tertiary hover:text-text-secondary transition-colors mt-1"
        >
          {showEditor ? "옵션 편집 닫기" : "옵션 편집"}
        </button>
      )}

      {allowOptionEdit && showEditor && (
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
                        // 조합 중 Enter 는 확정용, Escape 는 조합 취소용이므로 편집을 끝내지 않는다.
                        if (isImeComposing(e)) return
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
                      disabled={options.length <= 1}
                      className="p-1 text-text-tertiary hover:text-error transition-colors disabled:text-text-disabled disabled:hover:text-text-disabled disabled:cursor-not-allowed"
                      aria-label="옵션 삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {options.length <= 1 && (
            <p className="text-caption text-text-tertiary mt-2">
              옵션은 하나 이상 필요해요. 이름을 바꾸거나 새 옵션을 추가한 뒤 지울 수 있어요.
            </p>
          )}

          {/* Add new option */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              className="h-8 flex-1 min-w-0 rounded border border-border bg-surface px-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="새 옵션 추가..."
              value={newOption}
              onChange={e => setNewOption(e.target.value)}
              onKeyDown={onEnterCommit(addOption)}
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
