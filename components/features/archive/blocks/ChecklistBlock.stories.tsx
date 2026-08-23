import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, within } from "storybook/test"

import ChecklistBlock from "./ChecklistBlock"
import { checklistBlock, emptyChecklistBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof ChecklistBlock> = {
  title: "Features/Archive/Blocks/ChecklistBlock",
  component: ChecklistBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ChecklistBlock>

export const Empty: Story = {
  args: {
    block: emptyChecklistBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: checklistBlock,
    readOnly: false,
  },
}

/** 커스텀 블록(FRT-322) — 사용자가 만든 체크리스트만 항목을 더하고 지울 수 있다. */
export const CustomEditable: Story = {
  args: {
    block: checklistBlock,
    readOnly: false,
    allowOptionEdit: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByPlaceholderText("항목 추가...")).toBeInTheDocument()
  },
}

/**
 * 템플릿 블록(FRT-322) — 항목 추가·삭제 UI 가 없다.
 * ⚠️ 그릴 항목이 **하나도 없으면** 이 잠금은 풀린다(`Empty` 스토리) — mood-tag 가 태그를
 * 못 구해 폴백한 자리에서 추가까지 막으면 값을 넣을 방법이 없는 죽은 필드가 되기 때문이다.
 */
export const TemplateLocked: Story = {
  args: {
    block: checklistBlock,
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByPlaceholderText("항목 추가...")).toBeNull()
    await expect(canvas.queryByRole("button", { name: /삭제/ })).toBeNull()
  },
}

export const ReadOnly: Story = {
  args: {
    block: checklistBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyChecklistBlock,
    readOnly: true,
  },
}
