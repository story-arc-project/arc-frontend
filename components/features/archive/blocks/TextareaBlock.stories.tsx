import type { Meta, StoryObj } from "@storybook/nextjs"

import TextareaBlock from "./TextareaBlock"
import { textareaBlock, emptyTextareaBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof TextareaBlock> = {
  title: "Features/Archive/Blocks/TextareaBlock",
  component: TextareaBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TextareaBlock>

export const Empty: Story = {
  args: {
    block: emptyTextareaBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: textareaBlock,
    readOnly: false,
  },
}

/** guide 가 있으면 필드 아래 회색 안내문(hint)이 렌더된다 (FRT-90). */
export const WithGuide: Story = {
  args: {
    block: {
      ...emptyTextareaBlock,
      label: "지원 동기",
      guide: "지원한 동기가 무엇인가요? 참여하기로 결심한 이유가 있었다면 떠올려보세요. 완성된 문장이 아니어도 괜찮아요.",
    },
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: textareaBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyTextareaBlock,
    readOnly: true,
  },
}
