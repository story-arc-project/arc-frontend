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
