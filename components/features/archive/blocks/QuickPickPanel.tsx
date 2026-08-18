"use client"

import { useId, useState } from "react"
import { ChevronDown, Plus } from "lucide-react"
import { Chip } from "@/components/ui/chip"
import type { QuickPickPreset } from "@/lib/constants/quick-pick-presets"

interface QuickPickPanelProps {
  preset: QuickPickPreset
  /**
   * 지금 골라져 있는 값들. `multi` 면 태그 배열 그대로, `single` 이면 현재 값 하나짜리 배열이다.
   * 여기 실린 문자열과 항목 문자열이 **정확히 같을 때만** 선택됨으로 그린다 —
   * 사용자가 직접 친 값이나 예전 목록의 값은 그냥 선택 안 된 상태로 보이고, 그래도 값은 살아 있다.
   */
  selected: string[]
  /** 항목을 눌렀을 때. `multi` 는 토글(이미 있으면 해제), `single` 은 그 값으로 대체를 뜻한다. */
  onPick: (item: string) => void
  disabled?: boolean
}

/**
 * '＋ 빠른 선택' 그룹 픽커 (FRT-130).
 *
 * 평상시엔 버튼 하나만 보이고, 누르면 카테고리별 그룹이 펼쳐진다 — 확정본이 "태그를 일렬로
 * 늘어놓지 않는다"고 못박은 이유는 선택지를 늘 펼쳐 두면 입력 화면이 압도적으로 보이기 때문이다.
 *
 * 이 컴포넌트는 **값을 소유하지 않는다.** 고른 항목을 어디에 어떻게 담을지는 호출하는 블록이
 * 정한다(태그 배열에 추가 / 텍스트 대체) — 그래서 저장 shape 이 블록마다 그대로 유지된다.
 */
export default function QuickPickPanel({ preset, selected, onPick, disabled }: QuickPickPanelProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const isSelected = (item: string) => selected.includes(item)

  function handlePick(item: string) {
    onPick(item)
    // 단일 선택은 고르는 순간 할 일이 끝난다 — 열어 두면 방금 고른 값을 가리는 패널만 남는다.
    // 다중 선택은 연달아 고르는 게 정상이라 계속 열어 둔다.
    if (preset.mode === "single") setOpen(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={preset.title}
        className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-caption text-text-secondary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={14} />
        빠른 선택
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={preset.title}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface-secondary p-3"
        >
          {preset.groups.map(group => (
            <div key={group.label} className="flex flex-col gap-1.5">
              <p className="text-caption font-semibold text-text-tertiary">{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map(item => (
                  <Chip
                    key={item}
                    selected={isSelected(item)}
                    aria-pressed={isSelected(item)}
                    disabled={disabled}
                    onClick={() => handlePick(item)}
                  >
                    {item}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
