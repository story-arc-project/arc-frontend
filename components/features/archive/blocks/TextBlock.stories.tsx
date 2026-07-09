import type { Meta, StoryObj } from "@storybook/nextjs"

import TextBlock from "./TextBlock"
import { textBlock, emptyTextBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof TextBlock> = {
  title: "Features/Archive/Blocks/TextBlock",
  component: TextBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TextBlock>

export const Empty: Story = {
  args: {
    block: emptyTextBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: textBlock,
    readOnly: false,
  },
}

/** guide 가 있으면 필드 아래 회색 안내문(hint)이 렌더된다 (FRT-90). */
export const WithGuide: Story = {
  args: {
    block: {
      ...emptyTextBlock,
      label: "학회명",
      guide: "정식 명칭으로 적어주세요. 약칭이 더 잘 알려져 있다면 괄호로 함께 적어도 좋아요.",
    },
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: textBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyTextBlock,
    readOnly: true,
  },
}
