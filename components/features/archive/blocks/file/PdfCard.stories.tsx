import type { Meta, StoryObj } from "@storybook/nextjs"

import PdfCard from "./PdfCard"
import { samplePdfFile } from "../../__fixtures__/archive.fixtures"

const meta: Meta<typeof PdfCard> = {
  title: "Features/Archive/Blocks/File/PdfCard",
  component: PdfCard,
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof PdfCard>

export const Default: Story = {
  args: {
    name: samplePdfFile.name,
    size: samplePdfFile.size,
    url: samplePdfFile.url,
  },
}

export const WithDeleteButton: Story = {
  args: {
    name: samplePdfFile.name,
    size: samplePdfFile.size,
    url: samplePdfFile.url,
    onDelete: () => {},
  },
}

export const NoUrl: Story = {
  args: {
    name: samplePdfFile.name,
    size: samplePdfFile.size,
  },
}

export const NoSize: Story = {
  args: {
    name: samplePdfFile.name,
    url: samplePdfFile.url,
    onDelete: () => {},
  },
}
