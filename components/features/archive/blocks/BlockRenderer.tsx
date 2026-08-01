"use client"

import type { Block, BlockValue, RepeatableCellBlockValue } from "@/types/archive"
import { isFileCellValue } from "@/lib/utils/block-utils"
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

/** `OutcomeList` 가 그릴 수 있는 열 유형 — 셀을 textarea 하나로만 렌더한다. */
const OUTCOME_LIST_TYPES = new Set<string>(["text", "textarea"])

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
        //
        // FRT-213: 컬럼 개수만으로는 부족하다. `OutcomeList` 는 셀을 무조건 textarea 로 그리고
        // `blockType` 을 보지 않으므로, 열 유형을 기간·파일로 바꾸면 그 입력을 만들 길이 없고
        // 구조화된 첨부 값이 있으면 타이핑이 문자열로 덮어쓴다. 텍스트 모양일 때만 태운다.
        //
        // 열 유형만 보면 부족하다 — 파일로 바꿔 첨부를 올린 뒤 다시 텍스트로 되돌린 셀은
        // 유형이 `text` 인데 값은 첨부 객체다. 그대로 태우면 `OutcomeList` 가 파일명 문자열로
        // 접어 그리고 다음 타이핑이 첨부를 통째로 덮어쓴다. 저장된 값 모양까지 본다.
        const outcomeValue = block.value as RepeatableCellBlockValue
        const outcomeColumns = outcomeValue.columns
        const outcomeShape =
          outcomeColumns.length <= 1 &&
          (outcomeColumns[0] === undefined || OUTCOME_LIST_TYPES.has(outcomeColumns[0].blockType)) &&
          !outcomeValue.rows.some(row => Object.values(row.cells).some(isFileCellValue))
        return block.variant === "outcome-list" && outcomeShape
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
