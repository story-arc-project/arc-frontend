import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"
import type { Block, TableBlockValue } from "@/types/archive"
import type { Meta, StoryObj } from "@storybook/nextjs"

import TableBlock from "./TableBlock"
import { tableBlock, emptyTableBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof TableBlock> = {
  title: "Features/Archive/Blocks/TableBlock",
  component: TableBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TableBlock>

export const Empty: Story = {
  args: {
    block: emptyTableBlock,
    readOnly: false,
  },
}

export const WithData: Story = {
  args: {
    block: tableBlock,
    readOnly: false,
  },
}

export const ReadOnly: Story = {
  args: {
    block: tableBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyTableBlock,
    readOnly: true,
  },
}

function AccessibleTable() {
  const [value, setValue] = useState<TableBlockValue>({
    type: "table", columns: ["지표", "결과"], rows: [["속도", "120ms"], ["사용자", "28,000명"]],
  })
  const block: Block = { id: "accessible-table", type: "table", label: "성과 지표", value }
  return <TableBlock block={block} onChange={setValue} />
}

export const AccessibleCellContext: Story = {
  render: () => <AccessibleTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("textbox", { name: "성과 지표 1행 1열 지표" })).toHaveValue("속도")
    await expect(canvas.getByRole("textbox", { name: "성과 지표 2행 2열 결과" })).toHaveValue("28,000명")
    await userEvent.click(canvas.getAllByRole("button", { name: "행 삭제" })[0])
    await expect(canvas.getByRole("textbox", { name: "성과 지표 1행 1열 지표" })).toHaveValue("사용자")
    await userEvent.click(canvas.getByRole("button", { name: "행 추가" }))
    await expect(canvas.getByRole("textbox", { name: "성과 지표 2행 1열 지표" })).toHaveValue("")
  },
}
