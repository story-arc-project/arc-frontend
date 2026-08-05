"use client"

import { PeriodPicker } from "@/components/ui/period-picker"
import { formatPeriodString, parsePeriodString } from "@/lib/utils/period-format"
import type { Block, PeriodBlockValue } from "@/types/archive"

interface PeriodBlockProps {
  block: Block
  readOnly?: boolean
  /** 숨김 × 가 블록 우상단에 붙는 자리를 라벨 행에서 비워 둔다(FRT-190). */
  reserveHideSlot?: boolean
  onChange: (value: PeriodBlockValue) => void
}

function toDisplay(val: PeriodBlockValue): string {
  return formatPeriodString({ start: val.start, end: val.end, isCurrent: val.isCurrent })
}

export default function PeriodBlock({ block, readOnly, reserveHideSlot, onChange }: PeriodBlockProps) {
  const val = block.value as PeriodBlockValue
  if (readOnly) {
    const display = toDisplay(val)
    return (
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {display
          ? <p className="text-body text-text-primary">{display}</p>
          : <p className="text-body text-text-disabled">—</p>}
      </div>
    )
  }
  return (
    <PeriodPicker
      label={block.label}
      hint={block.guide}
      required={block.required}
      reserveTrailingSlot={reserveHideSlot}
      value={toDisplay(val)}
      onChange={str => {
        const { start, end, isCurrent } = parsePeriodString(str)
        onChange({ type: "period", start, end, isCurrent })
      }}
    />
  )
}
