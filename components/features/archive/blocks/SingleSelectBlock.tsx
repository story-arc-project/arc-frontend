"use client"

import { useId, useState } from "react"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
import { RequiredDot } from "@/components/ui/required-dot"
import type { Block, SingleSelectBlockValue } from "@/types/archive"
import { isImeComposing, onEnterCommit } from "@/lib/utils/keyboard"

/**
 * 프리셋에서 '직접 입력'을 여는 선택지 라벨 (FRT-322). 확정본 15개 필드가 이 문자열을 공유한다 —
 * 동작은 라벨에서 파생시키지 않고 `block.allowOther` 로 명시 opt-in 하며, 이 상수는 그 플래그가
 * 켜진 블록에서 **어느 선택지가 입력 모드인지**만 가리킨다.
 */
export const OTHER_OPTION_LABEL = "기타"

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
  /**
   * '기타' 직접 입력 (FRT-322). 플래그가 켜져 있어도 목록에 '기타'가 없으면 아무 일도 하지
   * 않는다 — 모르는 상태에서 입력칸이 열려 값을 덮으면 안 된다.
   */
  const hasOther = block.allowOther === true && base.includes(OTHER_OPTION_LABEL)
  /**
   * 저장값이 프리셋 밖이면 사용자가 '기타'로 적어 넣은 값이다 — 목록 끝에 붙이는 대신
   * '기타' 모드로 복원한다. 같은 값이 목록과 입력칸에 두 번 나오면 어느 쪽이 진짜인지 모른다.
   *
   * 저장값이 문자 그대로 "기타"인 경우도 같이 복원한다. 이 기능 전에는 '기타'를 골라도 아무
   * 일이 없었으므로 그 사람들의 저장값이 바로 이것인데, 평범한 프리셋 선택으로 보면 select 가
   * **이미 '기타'에 있어 다시 골라도 change 가 안 뜬다** — 다른 값을 거쳐 돌아오지 않는 한
   * 입력칸을 열 방법이 0이다. 이 PR 이 구제하려는 사람들이 정확히 그들이다.
   */
  const savedIsOther = hasOther && !!val.selected
    && (!base.includes(val.selected) || val.selected === OTHER_OPTION_LABEL)
  const [otherOpen, setOtherOpen] = useState(false)
  const otherMode = hasOther && (savedIsOther || otherOpen)
  const options = val.selected && !base.includes(val.selected) && !savedIsOther
    ? [...base, val.selected]
    : base
  /**
   * '기타' 모드에서는 필수 판정을 입력칸으로 넘긴다 — select 의 값은 "기타"라서 여기에
   * required 를 두면 정작 저장값(selected)이 비어 있는데 브라우저 검증이 통과한다.
   */
  const requiredOnSelect = !!block.required && !otherMode
  const [showEditor, setShowEditor] = useState(false)
  const [newOption, setNewOption] = useState("")
  /**
   * 편집 대상은 **인덱스가 아니라 값**으로 기억한다 (FRT-293). 편집 중이 아닌 행의 삭제 버튼은
   * 계속 활성이라 이름을 고치는 도중 앞 옵션이 사라지는 일이 실제로 일어나는데, 인덱스로 잡으면
   * 그때 배열이 밀려 확인 순간 엉뚱한 옵션이 덮어써진다. 값의 고유성은 `addOption`·`commitEdit`
   * 의 중복 검사가 이미 보장한다 — `ChecklistBlock`(값)·`RepeatableCellBlock`(필드 id)과 같은 규약.
   */
  const [editingOption, setEditingOption] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const selectId = useId()

  /**
   * 편집하던 옵션이 목록에서 빠지면 편집 상태를 **그 자리에서 비운다**. 렌더 조건만으로 입력칸을
   * 거두면 상태는 남아 있어서, 같은 이름이 다시 들어올 때(예: '새 옵션 추가'로 같은 이름 입력)
   * 새로 생긴 행이 옛 입력값을 문 채 편집 모드로 열리고 확인 한 번에 엉뚱하게 개명된다.
   * `options` 는 `val.selected` 가 프리셋 밖이면 그 값을 덧붙여 만들므로, 선택을 바꾸는 것만으로도
   * 편집 대상이 사라질 수 있다 — 바깥 재렌더가 아니어도 열리는 경로다.
   * 이펙트가 아니라 렌더 중 조정인 이유: 이펙트로 미루면 커밋이 한 번 더 돌아 그 사이의 렌더가
   * 낡은 상태를 그대로 쓴다. 조건이 다음 패스에서 곧바로 거짓이 되므로 루프도 아니다.
   */
  if (editingOption !== null && !options.includes(editingOption)) {
    setEditingOption(null)
    setEditValue("")
  }

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

  function startEdit(opt: string) {
    setEditingOption(opt)
    setEditValue(opt)
  }

  function commitEdit() {
    if (editingOption === null) return
    // 편집 중이던 옵션이 그 사이 목록에서 빠졌으면 확정할 대상이 없다 — 자리를 이어받은 옆
    // 옵션을 덮어쓰는 대신 편집만 닫는다. 아래 렌더 조건(`editingOption === opt`)이 이미 입력칸을
    // 거두므로 평소엔 도달하지 않지만, Enter 등 다른 호출처가 생겨도 안전하도록 남기는 이중 방어다.
    const targetIdx = options.indexOf(editingOption)
    const trimmed = editValue.trim()
    if (targetIdx === -1 || !trimmed || (options.includes(trimmed) && trimmed !== editingOption)) {
      setEditingOption(null)
      return
    }
    const newOptions = options.map((opt, i) => (i === targetIdx ? trimmed : opt))
    onChange({
      ...val,
      options: newOptions,
      selected: val.selected === editingOption ? trimmed : val.selected,
    })
    setEditingOption(null)
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
        value={otherMode ? OTHER_OPTION_LABEL : val.selected}
        onChange={e => {
          const next = e.target.value
          if (hasOther && next === OTHER_OPTION_LABEL) {
            // '기타'는 값이 아니라 입력 모드다 — 그대로 저장하면 분석이 "기타"라는 분야를 읽는다.
            setOtherOpen(true)
            onChange({ ...val, selected: "" })
            return
          }
          setOtherOpen(false)
          onChange({ ...val, selected: next })
        }}
        className={[
          "h-12 w-full rounded-md border border-border bg-surface px-4",
          "text-body text-text-primary",
          "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
          "transition-colors",
        ].join(" ")}
        required={requiredOnSelect}
      >
        <option value="">선택해주세요</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>

      {/* '기타' 직접 입력 — 프리셋 밖 값을 넣는 통로(FRT-322) */}
      {otherMode && (
        <input
          type="text"
          aria-label="기타 직접 입력"
          className={[
            "h-12 w-full rounded-md border border-border bg-surface px-4 mt-1.5",
            "text-body text-text-primary placeholder:text-text-tertiary",
            "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
            "transition-colors",
          ].join(" ")}
          placeholder="직접 입력해주세요"
          value={val.selected}
          onChange={e => {
            // 한 번 손댄 칸은 세션 동안 열어 둔다 — 비웠다고 닫으면 타이핑 도중 칸이 사라진다.
            setOtherOpen(true)
            onChange({ ...val, selected: e.target.value })
          }}
          required={block.required}
        />
      )}

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
              // key 도 값으로 잡는다 — 앞 옵션이 지워져 배열이 밀려도 편집 중인 입력칸이
              // 재마운트되지 않아 커서 위치와 autoFocus 가 흔들리지 않는다(FRT-293).
              <div key={opt} className="flex items-center gap-2">
                {editingOption === opt ? (
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
                        if (e.key === "Escape") setEditingOption(null)
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
                      onClick={() => setEditingOption(null)}
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
                      onClick={() => startEdit(opt)}
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
