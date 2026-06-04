import type { Meta, StoryObj } from "@storybook/nextjs"

import FileBlock from "./FileBlock"
import { emptyFileBlock, fileBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof FileBlock> = {
  title: "Features/Archive/Blocks/FileBlock",
  component: FileBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof FileBlock>

/**
 * Empty editable state — shows the file picker dropzone.
 * Kept to the empty/no-fileId state to avoid triggering the
 * getFileUrl() API call that would fail in Storybook.
 */
export const Empty: Story = {
  args: {
    block: emptyFileBlock,
    readOnly: false,
  },
}

/**
 * ReadOnly view with an attached file shown by name.
 * The fixture has no `fileId`, so FileBlock's getFileUrl() effect early-returns
 * and no backend call is made — the story stays deterministic in Storybook.
 */
export const ReadOnlyWithFile: Story = {
  args: {
    block: fileBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyFileBlock,
    readOnly: true,
  },
}
