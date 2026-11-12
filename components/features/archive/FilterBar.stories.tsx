import type { Meta, StoryObj } from "@storybook/nextjs"
import { useState } from "react"
import { expect, fn, userEvent, within } from "storybook/test"

import FilterBar from "./FilterBar"
import { emptyFilter, activeFilter } from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof FilterBar> = {
  title: "Features/Archive/FilterBar",
  component: FilterBar,
  tags: ["frt276"],
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
    await expect(canvas.getByRole("button", { name: "검색어 지우기" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(search).toHaveValue("")
    await expect(search).toHaveFocus()
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

export const FilterSelectionState: Story = {
  args: {
    filter: activeFilter,
    isFilterActive: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "필터" }))
    await expect(canvas.getByRole("button", { name: "완료", pressed: true })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "작성 중", pressed: false })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "인턴 및 업무 경력", pressed: true })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "동아리/교내 단체", pressed: false })).toBeVisible()
  },
}

export const TokensAndKeyboardClear: Story = {
  args: { filter: activeFilter, isFilterActive: true, onToggleStatus: fn(), onToggleType: fn() },
  render: function TokensStory(args) {
    const [filter, setFilter] = useState({ ...args.filter, search: "프로젝트" })
    return <div className="max-w-sm"><FilterBar {...args} filter={filter}
      onSearchChange={search => setFilter(current => ({ ...current, search }))}
      onToggleType={id => { args.onToggleType(id); setFilter(current => ({ ...current, typeIds: current.typeIds?.filter(value => value !== id) })) }}
      onToggleStatus={status => { args.onToggleStatus(status); setFilter(current => ({ ...current, statuses: current.statuses?.filter(value => value !== status) })) }}
    /></div>
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole("textbox", { name: "경험 검색" })
    const clear = canvas.getByRole("button", { name: "검색어 지우기" })
    clear.focus()
    await userEvent.keyboard(" ")
    await expect(search).toHaveValue("")
    await expect(search).toHaveFocus()
    const token = canvas.getByRole("button", { name: "완료 필터 해제" })
    token.focus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onToggleStatus).toHaveBeenCalledWith("complete")
    await expect(token).not.toBeInTheDocument()
    await expect(search).toHaveFocus()
    await expect(canvas.getByRole("button", { name: "인턴 및 업무 경력 필터 해제" })).toBeVisible()
  },
}
