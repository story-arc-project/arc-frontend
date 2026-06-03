import type { Meta, StoryObj } from "@storybook/nextjs"

import PresetManager from "./PresetManager"
import { samplePreset } from "./__fixtures__/archive.fixtures"
import type { Preset } from "@/types/archive"

const secondPreset: Preset = {
  id: "preset-02",
  name: "어학 경험 블록 세트",
  description: "언어 시험 및 해외 경험 기록용",
  blocks: [
    {
      id: "blk-p2-01",
      type: "text",
      label: "자격증명",
      value: { type: "text", text: "" },
    },
    {
      id: "blk-p2-02",
      type: "date",
      label: "취득일",
      value: { type: "date", date: "" },
    },
  ],
  isFavorite: false,
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-10T00:00:00.000Z",
}

const meta: Meta<typeof PresetManager> = {
  title: "Features/Archive/PresetManager",
  component: PresetManager,
  parameters: {
    layout: "padded",
  },
  args: {
    onToggleFavorite: () => {},
    onRename: () => {},
    onDuplicate: () => {},
    onDelete: () => {},
  },
}

export default meta

type Story = StoryObj<typeof PresetManager>

export const WithPresets: Story = {
  args: {
    presets: [samplePreset, secondPreset],
  },
}

export const SinglePreset: Story = {
  args: {
    presets: [samplePreset],
  },
}

export const Empty: Story = {
  args: {
    presets: [],
  },
}
