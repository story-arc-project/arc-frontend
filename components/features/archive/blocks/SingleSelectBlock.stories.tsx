import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, within } from "storybook/test"

import SingleSelectBlock from "./SingleSelectBlock"
import { singleSelectBlock, emptySingleSelectBlock } from "../__fixtures__/archive.fixtures"
import type { SingleSelectBlockValue } from "@/types/archive"

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

/** 옵션 편집을 연 상태 — 옵션이 여러 개면 각 줄에서 지울 수 있다. */
export const OptionEditorOpen: Story = {
  args: {
    block: singleSelectBlock,
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "옵션 편집" }))
    await expect(canvas.getAllByRole("button", { name: "옵션 삭제" }).length).toBeGreaterThan(1)
  },
}

/**
 * 옵션이 하나만 남은 상태(FRT-158). 더 지우면 고를 값이 없는 드롭다운이 되고
 * `block.options` 폴백이 지운 목록을 되살리므로, 삭제를 잠그고 회복 경로를 안내한다.
 */
export const LastOptionLocked: Story = {
  args: {
    block: {
      ...singleSelectBlock,
      options: ["정규직", "계약직", "인턴"],
      value: { ...(singleSelectBlock.value as SingleSelectBlockValue), options: ["정규직"], selected: "" },
    },
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "옵션 편집" }))
    await expect(canvas.getByRole("button", { name: "옵션 삭제" })).toBeDisabled()
    await expect(canvas.getByText(/옵션은 하나 이상 필요해요/)).toBeInTheDocument()
  },
}
