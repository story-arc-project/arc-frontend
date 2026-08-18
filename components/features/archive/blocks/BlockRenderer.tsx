"use client"

import type { Block, BlockValue, RepeatableCellBlockValue } from "@/types/archive"
import {
  isFileCellValue,
  isUnrenderableBlock,
  normalizeBlockForRender,
} from "@/lib/utils/block-utils"
import TextBlock from "./TextBlock"
import TextareaBlock from "./TextareaBlock"
import DateBlock from "./DateBlock"
import PeriodBlock from "./PeriodBlock"
import ChecklistBlock from "./ChecklistBlock"
import MoodTagBlock, { moodTagOptions } from "./MoodTagBlock"
import BinaryChoiceBlock, { binaryChoiceOptions } from "./BinaryChoiceBlock"
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
  /**
   * 이 블록에 숨김 × 가 붙는지(FRT-190). × 는 블록 우상단에 절대배치되므로, 같은 자리에
   * 컨트롤을 두는 렌더러(기간의 월/일 토글)는 그만큼 자리를 비켜야 클릭이 안 뺏긴다.
   */
  hideSlot?: boolean
  /** 첨부 업로드가 진행 중인지 상위에 알린다 — 그동안 × 를 감춰 파일 유실을 막는다(FRT-190). */
  onBusyChange?: (busy: boolean) => void
  /**
   * 선택지 자체를 고칠 수 있는지 (FRT-322). `BlockList` 의 `editEnabled`(커스텀 블록인가)를
   * 받아 옵션 편집 UI 를 가진 두 컴포넌트로 내린다 — 여기가 그들의 유일한 프로덕션 진입점이라
   * 관문 한 곳에서 전파하면 소비처마다 판정을 반복하지 않는다. 미지정이면 닫힘.
   */
  allowOptionEdit?: boolean
  onChange: (blockId: string, value: BlockValue) => void
}

export default function BlockRenderer({
  block: rawBlock,
  readOnly,
  hideSlot,
  onBusyChange,
  allowOptionEdit,
  onChange,
}: BlockRendererProps) {
  /**
   * 2차 방어 (FRT-200). 아래 13개 블록 컴포넌트는 모두 `block.value as XxxValue` 로 값을 단언한
   * 뒤 프로퍼티를 역참조하므로, 값이 깨져 있으면 그 자리에서 화면이 죽는다. 여기가 그 컴포넌트들의
   * **유일한 프로덕션 진입점**이라 관문 한 곳에서 막으면 13곳을 각각 고치지 않아도 된다.
   *
   * ⚠️ 이것이 매퍼(`toExperienceV2`)의 방어를 대신하지는 못한다 — 포트폴리오 빌드·목록 정렬처럼
   * 이 관문을 거치지 않고 `block.value` 를 직접 읽는 소비처가 따로 있다. 저장 값 정규화의
   * 정본은 매퍼이고, 여기는 그곳을 우회해 들어온 값을 막는 그물이다.
   *
   * 값이 온전하면 **원본 참조를 그대로** 돌려주므로 리렌더가 늘지 않는다.
   *
   * ⚠️ 표시 전용 보정(`...ForRender`)을 쓴다 — 이 코드가 모르는 판별자(새 스키마가 쓴 값)를
   * 저장 경로에서 갈아 끼우면 구 프론트가 그 값을 굳혀 버리므로, 모양 맞추기는 여기서만 한다.
   */
  const block = normalizeBlockForRender(rawBlock)
  /**
   * ⚠️ **모르는 판별자 위에는 편집 칸을 띄우지 않는다.** 위 보정은 "그릴 모양"을 만들어 줄 뿐이고,
   * 그게 편집 가능하면 사용자의 첫 입력이 **보존해 둔 새 스키마 값을 덮는다** — 값을 지키려고
   * 만든 폴백이 값을 지우는 통로가 된다. 읽기 전용으로 두면 그 값은 저장 왕복에서 그대로 산다.
   */
  // 판별자가 미지이거나 **블록 타입과 어긋나면** 그 값은 이 컨트롤이 다룰 수 있는 값이 아니다.
  // ⚠️ 판정은 `isUnrenderableBlock` 하나로 모은다 — 바깥 연필(`BlockList`)이 같은 술어로
  // 물어야 편집 경로가 한쪽만 열린 채 남지 않는다.
  const locked = readOnly || isUnrenderableBlock(rawBlock)
  const handleChange = (value: BlockValue) => onChange(block.id, value)

  const rendered = (() => {
    switch (block.type) {
      case "text":
        return <TextBlock block={block} readOnly={locked} onChange={handleChange} />
      case "textarea":
        return <TextareaBlock block={block} readOnly={locked} onChange={handleChange} />
      case "date":
        return <DateBlock block={block} readOnly={locked} onChange={handleChange} />
      case "period":
        return (
          <PeriodBlock
            block={block}
            readOnly={locked}
            reserveHideSlot={hideSlot}
            onChange={handleChange}
          />
        )
      case "checklist": {
        // mood-tag 는 고정 프리셋 알약 UI(FRT-177). 그릴 태그를 하나도 못 구했을 때만
        // (저장 options·템플릿 프리셋·checked 가 모두 빔) 옵션을 새로 만들 수 있는
        // ChecklistBlock 으로 폴백한다 — 판정은 렌더와 같은 계산을 써야 갈리지 않는다.
        return block.variant === "mood-tag" && moodTagOptions(block).length > 0
          ? <MoodTagBlock block={block} readOnly={locked} onChange={handleChange} />
          : (
            <ChecklistBlock
              block={block}
              readOnly={locked}
              allowOptionEdit={allowOptionEdit}
              onChange={handleChange}
            />
          )
      }
      case "single-select": {
        // binary-choice 는 두 카드 양자택일 UI(FRT-320). 옵션이 정확히 2개일 때만 그릴 수 있다 —
        // 사용자가 옵션 편집으로 늘린 저장값이면 값이 숨지 않도록 드롭다운으로 폴백한다.
        // 판정은 렌더와 같은 계산을 써야 갈리지 않는다.
        return block.variant === "binary-choice" && binaryChoiceOptions(block)
          ? <BinaryChoiceBlock block={block} readOnly={locked} onChange={handleChange} />
          : (
            <SingleSelectBlock
              block={block}
              readOnly={locked}
              allowOptionEdit={allowOptionEdit}
              onChange={handleChange}
            />
          )
      }
      case "tags":
        return <TagsBlock block={block} readOnly={locked} onChange={handleChange} />
      case "link":
        return <LinkBlock block={block} readOnly={locked} onChange={handleChange} />
      case "file":
        return (
          <FileBlock
            block={block}
            readOnly={locked}
            onBusyChange={onBusyChange}
            onChange={handleChange}
          />
        )
      case "repeatable-cell": {
        // role-history 는 접이식 역할 이력 패널(FRT-178). 역할명을 읽을 `role` 컬럼이 없으면
        // 이름을 하나도 만들어내지 못하므로 표형으로 폴백한다 — 판정은 렌더와 같은 계산을 쓴다.
        if (block.variant === "role-history" && hasRoleHistoryShape(block)) {
          return <RoleHistoryBlock block={block} readOnly={locked} onChange={handleChange} />
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
          ? <OutcomeList block={block} readOnly={locked} onChange={handleChange} />
          : <RepeatableCellBlock block={block} readOnly={locked} onChange={handleChange} />
      }
      case "table":
        return <TableBlock block={block} readOnly={locked} onChange={handleChange} />
    }
  })()

  // FRT-190: '선택' 뱃지는 없앴다. 표시를 다수(선택)가 아니라 소수(필수)에 붙이는 쪽으로 뒤집어
  // 라벨 옆 주황 점(`RequiredDot`)으로 그린다 — 뱃지는 `absolute` 오버레이라 블록 우상단의
  // `N개 항목`(RepeatableCellBlock) 과 겹쳤고, 경험 상세 카드에만 붙어 신호도 일관되지 않았다.
  return rendered ?? null
}
