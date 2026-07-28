"use client"

import type { Block, BlockValue, ChecklistBlockValue, RepeatableCellBlockValue } from "@/types/archive"
import TextBlock from "./TextBlock"
import TextareaBlock from "./TextareaBlock"
import DateBlock from "./DateBlock"
import PeriodBlock from "./PeriodBlock"
import ChecklistBlock from "./ChecklistBlock"
import MoodTagBlock from "./MoodTagBlock"
import SingleSelectBlock from "./SingleSelectBlock"
import TagsBlock from "./TagsBlock"
import LinkBlock from "./LinkBlock"
import FileBlock from "./FileBlock"
import RepeatableCellBlock from "./RepeatableCellBlock"
import OutcomeList from "./OutcomeList"
import TableBlock from "./TableBlock"

interface BlockRendererProps {
  block: Block
  readOnly?: boolean
  showOptionalBadge?: boolean
  onChange: (blockId: string, value: BlockValue) => void
}

export default function BlockRenderer({ block, readOnly, showOptionalBadge, onChange }: BlockRendererProps) {
  const handleChange = (value: BlockValue) => onChange(block.id, value)

  const rendered = (() => {
    switch (block.type) {
      case "text":
        return <TextBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "textarea":
        return <TextareaBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "date":
        return <DateBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "period":
        return <PeriodBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "checklist": {
        // mood-tag 는 고정 프리셋 알약 UI(FRT-177). 옵션이 비어 있으면(구 레코드에서 옵션이
        // 지워졌거나 손상된 값) 선택할 게 하나도 없는 빈 줄이 되므로, 옵션 관리가 가능한
        // ChecklistBlock 으로 폴백해 사용자가 되살릴 수 있게 한다(OutcomeList 폴백과 동형).
        const options = (block.value as ChecklistBlockValue).options
        return block.variant === "mood-tag" && options.length > 0
          ? <MoodTagBlock block={block} readOnly={readOnly} onChange={handleChange} />
          : <ChecklistBlock block={block} readOnly={readOnly} onChange={handleChange} />
      }
      case "single-select":
        return <SingleSelectBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "tags":
        return <TagsBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "link":
        return <LinkBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "file":
        return <FileBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "repeatable-cell": {
        // outcome-list 는 개조식 불릿-행 UI(단일컬럼 전용). 사용자가 '열 추가'로 컬럼을
        // 늘린 레거시 값이면 데이터가 숨지 않도록 표형 RepeatableCellBlock 으로 폴백한다(FRT-97).
        const columnCount = (block.value as RepeatableCellBlockValue).columns.length
        return block.variant === "outcome-list" && columnCount <= 1
          ? <OutcomeList block={block} readOnly={readOnly} onChange={handleChange} />
          : <RepeatableCellBlock block={block} readOnly={readOnly} onChange={handleChange} />
      }
      case "table":
        return <TableBlock block={block} readOnly={readOnly} onChange={handleChange} />
    }
  })()

  if (showOptionalBadge && !block.required && !readOnly) {
    return (
      <div className="relative">
        <span className="absolute -top-2 right-0 z-10 text-caption text-text-tertiary bg-surface border border-border rounded-full px-2 py-0.5">
          선택
        </span>
        {rendered}
      </div>
    )
  }
  return rendered ?? null
}
