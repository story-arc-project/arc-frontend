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
