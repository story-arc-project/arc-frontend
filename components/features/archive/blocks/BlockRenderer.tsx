"use client"

import type { Block, BlockValue, RepeatableCellBlockValue } from "@/types/archive"
import TextBlock from "./TextBlock"
import TextareaBlock from "./TextareaBlock"
import DateBlock from "./DateBlock"
import PeriodBlock from "./PeriodBlock"
import ChecklistBlock from "./ChecklistBlock"
import MoodTagBlock, { moodTagOptions } from "./MoodTagBlock"
import SingleSelectBlock from "./SingleSelectBlock"
import TagsBlock from "./TagsBlock"
import LinkBlock from "./LinkBlock"
import FileBlock from "./FileBlock"
import RepeatableCellBlock from "./RepeatableCellBlock"
import RoleHistoryBlock, { hasRoleHistoryShape } from "./RoleHistoryBlock"
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
        // mood-tag 는 고정 프리셋 알약 UI(FRT-177). 그릴 태그를 하나도 못 구했을 때만
        // (저장 options·템플릿 프리셋·checked 가 모두 빔) 옵션을 새로 만들 수 있는
        // ChecklistBlock 으로 폴백한다 — 판정은 렌더와 같은 계산을 써야 갈리지 않는다.
        return block.variant === "mood-tag" && moodTagOptions(block).length > 0
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
        // role-history 는 접이식 역할 이력 패널(FRT-178). 역할명을 읽을 `role` 컬럼이 없으면
        // 이름을 하나도 만들어내지 못하므로 표형으로 폴백한다 — 판정은 렌더와 같은 계산을 쓴다.
        if (block.variant === "role-history" && hasRoleHistoryShape(block)) {
          return <RoleHistoryBlock block={block} readOnly={readOnly} onChange={handleChange} />
        }
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
