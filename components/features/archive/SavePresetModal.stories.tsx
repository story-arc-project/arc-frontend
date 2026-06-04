import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs"

import SavePresetModal from "./SavePresetModal"
import { careerExperience } from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof SavePresetModal> = {
  title: "Features/Archive/SavePresetModal",
  component: SavePresetModal,
  parameters: {
    layout: "centered",
  },
}

export default meta

type Story = StoryObj<typeof SavePresetModal>

function OpenSavePresetModal() {
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
      <SavePresetModal
        open={open}
        blocks={careerExperience.extensionBlocks}
        onClose={() => setOpen(false)}
        onSave={() => { setOpen(false) }}
      />
    </>
  )
}

function OpenSavePresetModalEmpty() {
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
      <SavePresetModal
        open={open}
        blocks={[]}
        onClose={() => setOpen(false)}
        onSave={() => { setOpen(false) }}
      />
    </>
  )
}

/** Modal open with extension blocks pre-selected. */
export const WithBlocks: Story = {
  render: () => <OpenSavePresetModal />,
}

/** Modal open with no blocks available. */
export const NoBlocks: Story = {
  render: () => <OpenSavePresetModalEmpty />,
}
