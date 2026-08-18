import type { Meta, StoryObj } from "@storybook/nextjs"

import TagsBlock from "./TagsBlock"
import { tagsBlock, emptyTagsBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof TagsBlock> = {
  title: "Features/Archive/Blocks/TagsBlock",
  component: TagsBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TagsBlock>

export const Empty: Story = {
  args: {
    block: emptyTagsBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: tagsBlock,
    readOnly: false,
  },
}

/** guide 가 있으면 라벨과 태그 입력 사이에 회색 안내문이 렌더된다 (FRT-90). */
export const WithGuide: Story = {
  args: {
    block: {
      ...emptyTagsBlock,
      label: "사용한 스킬 / 툴 / 기술",
      guide: "이 활동에서 실제로 배우거나 사용한 기술, 툴, 언어 등을 태그로 추가해주세요",
    },
    readOnly: false,
  },
}

/**
 * 인턴 ① '산업 / 회사 종류' (FRT-130). 평상시엔 `＋ 빠른 선택` 버튼 하나만 보이고,
 * 누르면 6 카테고리 그룹이 펼쳐진다 — 고른 항목은 위쪽 오렌지 뱃지로 쌓인다(다중 선택).
 */
export const WithQuickPick: Story = {
  args: {
    block: {
      ...emptyTagsBlock,
      label: "산업 / 회사 종류",
      guide: "빠른 선택에서 고르거나 직접 입력해주세요. 여러 개 고를 수 있어요.",
      quickPick: "industry",
    },
    readOnly: false,
  },
}

/** 이미 고른 값이 있는 상태 — 픽커를 열면 그 항목이 눌린 칩으로 보인다. */
export const QuickPickWithSelection: Story = {
  args: {
    block: {
      ...emptyTagsBlock,
      label: "산업 / 회사 종류",
      guide: "빠른 선택에서 고르거나 직접 입력해주세요. 여러 개 고를 수 있어요.",
      quickPick: "industry",
      value: { type: "tags", tags: ["스타트업", "핀테크"] },
    },
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: tagsBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyTagsBlock,
    readOnly: true,
  },
}
