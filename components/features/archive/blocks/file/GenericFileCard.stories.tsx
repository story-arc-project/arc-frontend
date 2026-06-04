import type { Meta, StoryObj } from "@storybook/nextjs"

import GenericFileCard from "./GenericFileCard"
import { sampleGenericFile } from "../../__fixtures__/archive.fixtures"

const meta: Meta<typeof GenericFileCard> = {
  title: "Features/Archive/Blocks/File/GenericFileCard",
  component: GenericFileCard,
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof GenericFileCard>

export const Default: Story = {
  args: {
    name: sampleGenericFile.name,
    size: sampleGenericFile.size,
    url: sampleGenericFile.url,
  },
}

export const WithDeleteButton: Story = {
  args: {
    name: sampleGenericFile.name,
    size: sampleGenericFile.size,
    url: sampleGenericFile.url,
    onDelete: () => {},
  },
}

export const WithBadge: Story = {
  args: {
    name: sampleGenericFile.name,
    size: sampleGenericFile.size,
    url: sampleGenericFile.url,
    badge: "ZIP",
    onDelete: () => {},
  },
}

export const NoUrl: Story = {
  args: {
    name: sampleGenericFile.name,
    size: sampleGenericFile.size,
  },
}

export const NoName: Story = {
  args: {
    name: "",
    size: sampleGenericFile.size,
    url: sampleGenericFile.url,
    onDelete: () => {},
  },
}
