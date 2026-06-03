import type { Meta, StoryObj } from "@storybook/nextjs"

import FilterBar from "./FilterBar"
import { emptyFilter, activeFilter } from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof FilterBar> = {
  title: "Features/Archive/FilterBar",
  component: FilterBar,
  parameters: {
    layout: "padded",
  },
  args: {
    onSearchChange: () => {},
    onSortChange: () => {},
    onToggleType: () => {},
    onToggleStatus: () => {},
    onClearFilters: () => {},
    onSaveAsLibrary: () => {},
  },
}

export default meta

type Story = StoryObj<typeof FilterBar>

export const Empty: Story = {
  args: {
    filter: emptyFilter,
    isFilterActive: false,
  },
}

export const WithActiveFilter: Story = {
  args: {
    filter: activeFilter,
    isFilterActive: true,
  },
}

export const NoSaveOption: Story = {
  args: {
    filter: activeFilter,
    isFilterActive: true,
    onSaveAsLibrary: undefined,
  },
}
