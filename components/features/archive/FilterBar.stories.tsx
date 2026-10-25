import type { Meta, StoryObj } from "@storybook/nextjs"
import { useState } from "react"
import { expect, fn, userEvent, within } from "storybook/test"

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

export const SearchAccessibleName: Story = {
  args: {
    filter: emptyFilter,
    isFilterActive: false,
    onSearchChange: fn(),
  },
  render: function SearchAccessibleNameStory(args) {
    const [search, setSearch] = useState("")
    return <FilterBar {...args} filter={{ ...args.filter, search }} onSearchChange={value => {
      setSearch(value)
      args.onSearchChange(value)
    }} />
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole("textbox", { name: "경험 검색" })
    await expect(search).toHaveValue("")
    await userEvent.click(search)
    await userEvent.type(search, "프로젝트")
    await expect(search).toHaveAccessibleName("경험 검색")
    await expect(search).toHaveValue("프로젝트")
    await expect(args.onSearchChange).toHaveBeenLastCalledWith("프로젝트")
    await userEvent.tab()
    await expect(canvas.getByRole("combobox")).toHaveFocus()
    await userEvent.tab({ shift: true })
    await expect(search).toHaveFocus()
    await userEvent.clear(search)
    await expect(search).toHaveValue("")
    await expect(search).toHaveAccessibleName("경험 검색")
    await expect(args.onSearchChange).toHaveBeenLastCalledWith("")
  },
}
