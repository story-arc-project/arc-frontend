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

/**
 * 인턴 ① '직무 / 포지션' (FRT-130). 5 카테고리 15종 단일 선택 —
 * 고르면 입력칸 값이 그 값으로 대체되고 패널이 닫힌다. 목록에 없으면 직접 쳐도 된다.
 */
export const WithQuickPick: Story = {
  args: {
    block: {
      ...emptyTextBlock,
      label: "직무 / 포지션",
      guide: "빠른 선택에서 고르거나 직접 적어주세요.",
      placeholder: "예: 브랜드 마케팅 인턴",
      required: true,
      quickPick: "job-function",
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
