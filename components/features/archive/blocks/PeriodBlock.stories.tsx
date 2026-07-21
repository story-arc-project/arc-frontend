import type { Meta, StoryObj } from "@storybook/nextjs"

import PeriodBlock from "./PeriodBlock"
import { periodBlock, periodBlockFinished, periodBlockDay, emptyPeriodBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof PeriodBlock> = {
  title: "Features/Archive/Blocks/PeriodBlock",
  component: PeriodBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof PeriodBlock>

export const Empty: Story = {
  args: {
    block: emptyPeriodBlock,
    readOnly: false,
  },
}

/** 라벨 아래 안내문(guide). 문서 확정본이 기간 입력에도 가이드 문구를 지정한다(FRT-135). */
export const WithGuide: Story = {
  args: {
    block: {
      ...emptyPeriodBlock,
      label: "근무 기간",
      guide: "인턴 근무를 시작하고 종료한 시점을 선택해주세요.",
    },
    readOnly: false,
  },
}

export const CurrentPeriod: Story = {
  args: {
    block: periodBlock,
    readOnly: false,
  },
}

export const FinishedPeriod: Story = {
  args: {
    block: periodBlockFinished,
    readOnly: false,
  },
}

export const DayPeriod: Story = {
  args: {
    block: periodBlockDay,
    readOnly: false,
  },
}

export const DayPeriodReadOnly: Story = {
  args: {
    block: periodBlockDay,
    readOnly: true,
  },
}

export const ReadOnly: Story = {
  args: {
    block: periodBlock,
    readOnly: true,
  },
}

export const ReadOnlyFinished: Story = {
  args: {
    block: periodBlockFinished,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyPeriodBlock,
    readOnly: true,
  },
}
