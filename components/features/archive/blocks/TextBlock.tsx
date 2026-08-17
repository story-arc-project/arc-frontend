"use client"

import { Input } from "@/components/ui/input"
import type { Block, TextBlockValue } from "@/types/archive"
import { getQuickPickPreset } from "@/lib/constants/quick-pick-presets"
import QuickPickPanel from "./QuickPickPanel"

interface TextBlockProps {
  block: Block
  readOnly?: boolean
  onChange: (value: TextBlockValue) => void
}

export default function TextBlock({ block, readOnly, onChange }: TextBlockProps) {
  const val = block.value as TextBlockValue
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-brand/30 pl-3.5">
        <span className="text-caption text-text-tertiary font-semibold tracking-wide">{block.label}</span>
        {val.text
          ? <p className="text-body text-text-primary">{val.text}</p>
          : <p className="text-body text-text-disabled">—</p>}
      </div>
    )
  }
  const input = (
    <Input
      label={block.label}
      placeholder={block.placeholder}
      hint={block.guide}
      hintPosition="top"
      value={val.text}
      onChange={e => onChange({ type: "text", text: e.target.value })}
      required={block.required}
    />
  )

  /**
   * '＋ 빠른 선택' 픽커(FRT-130). 단일 선택 프리셋일 때만 붙는다 — 텍스트 칸은 값이 하나뿐이라
   * 다중 선택 프리셋을 태우면 고를 때마다 앞 값이 조용히 지워진다. 프리셋이 없거나 모르는 id 면
   * **기존 반환을 그대로** 돌려주므로 픽커를 켜지 않은 텍스트 필드는 마크업이 전혀 바뀌지 않는다.
   */
  const preset = getQuickPickPreset(block.quickPick)
  if (preset?.mode !== "single") return input

  return (
    <div className="flex flex-col gap-2">
      {input}
      <QuickPickPanel
        preset={preset}
        // 직접 친 값도 목록에 있으면 선택됨으로 보인다 — 판정은 문자열 일치 하나로 통일한다.
        selected={val.text ? [val.text] : []}
        onPick={item => onChange({ type: "text", text: item })}
      />
    </div>
  )
}
