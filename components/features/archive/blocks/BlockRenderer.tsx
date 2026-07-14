"use client"

import type { Block, BlockValue } from "@/types/archive"
import TextBlock from "./TextBlock"
import TextareaBlock from "./TextareaBlock"
import DateBlock from "./DateBlock"
import PeriodBlock from "./PeriodBlock"
import ChecklistBlock from "./ChecklistBlock"
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
      case "checklist":
        return <ChecklistBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "single-select":
        return <SingleSelectBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "tags":
        return <TagsBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "link":
        return <LinkBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "file":
        return <FileBlock block={block} readOnly={readOnly} onChange={handleChange} />
      case "repeatable-cell":
        // 단일컬럼 outcome-list 는 개조식 불릿-행 UI 로, 그 외 다중컬럼은 표형으로 렌더(FRT-97).
        return block.variant === "outcome-list"
          ? <OutcomeList block={block} readOnly={readOnly} onChange={handleChange} />
          : <RepeatableCellBlock block={block} readOnly={readOnly} onChange={handleChange} />
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
