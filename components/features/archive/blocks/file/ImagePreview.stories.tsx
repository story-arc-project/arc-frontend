import type { Meta, StoryObj } from "@storybook/nextjs"

import ImagePreview from "./ImagePreview"
import { sampleImageDataUri } from "../../__fixtures__/archive.fixtures"

const meta: Meta<typeof ImagePreview> = {
  title: "Features/Archive/Blocks/File/ImagePreview",
  component: ImagePreview,
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof ImagePreview>

export const Default: Story = {
  args: {
    name: "프로젝트_스크린샷.png",
    url: sampleImageDataUri,
  },
}

export const WithDeleteButton: Story = {
  args: {
    name: "프로젝트_스크린샷.png",
    url: sampleImageDataUri,
    onDelete: () => {},
  },
}

export const NoName: Story = {
  args: {
    name: "",
    url: sampleImageDataUri,
    onDelete: () => {},
  },
}

/** FileBlock 처럼 `flex flex-col` 부모 안에 놓였을 때 — 카드가 가로로 stretch 되지 않고 이미지 폭만 차지해야 한다. */
export const InsideFlexColumn: Story = {
  args: {
    name: "프로젝트_스크린샷.png",
    url: sampleImageDataUri,
  },
  decorators: [
    (Story) => (
      <div className="flex w-[720px] flex-col gap-2 rounded-md border border-dashed border-border p-3">
        <Story />
      </div>
    ),
  ],
}
