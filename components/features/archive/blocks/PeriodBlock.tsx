"use client"

import { PeriodPicker } from "@/components/ui/period-picker"
import type { Block, PeriodBlockValue } from "@/types/archive"

interface PeriodBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: PeriodBlockValue) => void
}

function formatPeriodToString(val: PeriodBlockValue): string {
  if (!val.start) return ""
  const end = val.isCurrent ? "현재" : val.end
  return end ? `${val.start} ~ ${end}` : val.start
}

function parsePeriodFromString(str: string): PeriodBlockValue {
  const isCurrent = str.includes("현재")
  const parts = str.split("~").map(s => s.trim())
  return {
    type: "period",
    start: parts[0]?.replace(".", "-") ?? "",
    end: isCurrent ? "" : (parts[1]?.replace(".", "-") ?? ""),
    isCurrent,
  }
}

export default function PeriodBlock({ block, readOnly, onChange }: PeriodBlockProps) {
  const val = block.value as PeriodBlockValue
  if (readOnly) {
    const display = formatPeriodToString(val)
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
      value={formatPeriodToString(val)}
      onChange={str => onChange(parsePeriodFromString(str))}
    />
  )
}
