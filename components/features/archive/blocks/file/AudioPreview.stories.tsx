import type { Meta, StoryObj } from "@storybook/nextjs"

import AudioPreview from "./AudioPreview"
import { sampleAudioFile } from "../../__fixtures__/archive.fixtures"

const meta: Meta<typeof AudioPreview> = {
  title: "Features/Archive/Blocks/File/AudioPreview",
  component: AudioPreview,
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof AudioPreview>

export const Default: Story = {
  args: {
    name: sampleAudioFile.name,
    url: sampleAudioFile.url,
    mimeType: sampleAudioFile.mimeType,
    size: sampleAudioFile.size,
  },
}

export const WithDeleteButton: Story = {
  args: {
    name: sampleAudioFile.name,
    url: sampleAudioFile.url,
    mimeType: sampleAudioFile.mimeType,
    size: sampleAudioFile.size,
    onDelete: () => {},
  },
}

export const NoSize: Story = {
  args: {
    name: sampleAudioFile.name,
    url: sampleAudioFile.url,
    mimeType: sampleAudioFile.mimeType,
  },
}
