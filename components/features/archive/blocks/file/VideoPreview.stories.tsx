import type { Meta, StoryObj } from "@storybook/nextjs"

import VideoPreview from "./VideoPreview"
import { sampleVideoFile } from "../../__fixtures__/archive.fixtures"

const meta: Meta<typeof VideoPreview> = {
  title: "Features/Archive/Blocks/File/VideoPreview",
  component: VideoPreview,
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof VideoPreview>

export const Default: Story = {
  args: {
    name: sampleVideoFile.name,
    url: sampleVideoFile.url,
    mimeType: sampleVideoFile.mimeType,
  },
}

export const WithDeleteButton: Story = {
  args: {
    name: sampleVideoFile.name,
    url: sampleVideoFile.url,
    mimeType: sampleVideoFile.mimeType,
    onDelete: () => {},
  },
}
