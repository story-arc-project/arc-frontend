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
import TableBlock from "./TableBlock"

interface BlockRendererProps {
  block: Block
  readOnly?: boolean
  onChange: (blockId: string, value: BlockValue) => void
}

export default function BlockRenderer({ block, readOnly, onChange }: BlockRendererProps) {
  const handleChange = (value: BlockValue) => onChange(block.id, value)

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
      return <RepeatableCellBlock block={block} readOnly={readOnly} onChange={handleChange} />
    case "table":
      return <TableBlock block={block} readOnly={readOnly} onChange={handleChange} />
  }
}
