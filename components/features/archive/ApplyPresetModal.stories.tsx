import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs"

import ApplyPresetModal from "./ApplyPresetModal"
import { samplePreset } from "./__fixtures__/archive.fixtures"
import type { Preset } from "@/types/archive"

const secondPreset: Preset = {
  id: "preset-apply-02",
  name: "어학 경험 블록 세트",
  description: "언어 시험 및 해외 경험 기록용",
  blocks: [
    {
      id: "blk-ap2-01",
      type: "text",
      label: "자격증명",
      value: { type: "text", text: "" },
    },
  ],
  isFavorite: false,
  createdAt: "2025-05-01T00:00:00.000Z",
  updatedAt: "2025-05-10T00:00:00.000Z",
}

const meta: Meta<typeof ApplyPresetModal> = {
  title: "Features/Archive/ApplyPresetModal",
  component: ApplyPresetModal,
  parameters: {
    layout: "centered",
  },
}

export default meta

type Story = StoryObj<typeof ApplyPresetModal>

function OpenApplyPresetModal() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-4 py-2 text-body-sm text-text-secondary hover:bg-surface-secondary"
      >
        모달 열기
      </button>
      <ApplyPresetModal
        open={open}
        presets={[samplePreset, secondPreset]}
        onClose={() => setOpen(false)}
        onApply={() => { setOpen(false) }}
      />
    </>
  )
}

function OpenApplyPresetModalEmpty() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-4 py-2 text-body-sm text-text-secondary hover:bg-surface-secondary"
      >
        모달 열기
      </button>
      <ApplyPresetModal
        open={open}
        presets={[]}
        onClose={() => setOpen(false)}
        onApply={() => { setOpen(false) }}
      />
    </>
  )
}

/** Modal open with a list of available presets. */
export const WithPresets: Story = {
  render: () => <OpenApplyPresetModal />,
}

/** Modal open with no presets available. */
export const NoPresets: Story = {
  render: () => <OpenApplyPresetModalEmpty />,
}
