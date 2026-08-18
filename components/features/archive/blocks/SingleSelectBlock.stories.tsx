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

/**
 * 템플릿 블록(FRT-322) — 확정본이 목록을 소유하므로 옵션 편집 토글이 아예 없다.
 * `allowOptionEdit` 미지정이 이 상태이며, 폼의 고정 카드가 전부 여기에 해당한다.
 */
export const TemplateLocked: Story = {
  args: {
    block: singleSelectBlock,
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("button", { name: "옵션 편집" })).toBeNull()
    await expect(canvas.getByRole("combobox")).toBeInTheDocument()
  },
}

/**
 * '기타' 직접 입력(FRT-322). 확정본이 이미 가진 '기타'를 고르면 그 자리에서 적을 수 있다 —
 * 인라인 편집을 막은 뒤 프리셋 밖 값을 넣는 유일한 통로다. 적은 값은 `selected` 에 원문으로 간다.
 */
export const OtherDirectInput: Story = {
  args: {
    block: {
      ...emptySingleSelectBlock,
      label: "자격증 분야",
      options: ["IT/개발", "데이터/AI", "디자인/크리에이티브", "기타"],
      allowOther: true,
      value: { type: "single-select", options: [], selected: "" },
    },
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.selectOptions(canvas.getByRole("combobox"), "기타")
    await expect(canvas.getByLabelText("기타 직접 입력")).toBeInTheDocument()
  },
}

/** 옵션 편집을 연 상태 — 커스텀 블록에서만 열린다(FRT-322). 옵션이 여러 개면 각 줄에서 지울 수 있다. */
export const OptionEditorOpen: Story = {
  args: {
    block: singleSelectBlock,
    readOnly: false,
    allowOptionEdit: true,
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
    allowOptionEdit: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "옵션 편집" }))
    await expect(canvas.getByRole("button", { name: "옵션 삭제" })).toBeDisabled()
    await expect(canvas.getByText(/옵션은 하나 이상 필요해요/)).toBeInTheDocument()
  },
}
