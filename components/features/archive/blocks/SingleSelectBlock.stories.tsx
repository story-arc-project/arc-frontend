import type { Meta, StoryObj } from "@storybook/nextjs"

import SingleSelectBlock from "./SingleSelectBlock"
import { singleSelectBlock, emptySingleSelectBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof SingleSelectBlock> = {
  title: "Features/Archive/Blocks/SingleSelectBlock",
  component: SingleSelectBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof SingleSelectBlock>

export const Empty: Story = {
  args: {
    block: emptySingleSelectBlock,
    readOnly: false,
  },
}

/** 라벨 아래 안내문(guide). 문서 확정본이 드롭다운에도 가이드 문구를 지정한다(FRT-135). */
export const WithGuide: Story = {
  args: {
    block: {
      ...emptySingleSelectBlock,
      label: "수업 분류",
      guide: "이 강좌의 이수 구분을 선택해주세요.",
    },
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: singleSelectBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: singleSelectBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptySingleSelectBlock,
    readOnly: true,
  },
}
