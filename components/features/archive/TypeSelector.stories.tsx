import type { Meta, StoryObj } from "@storybook/nextjs"

import TypeSelector from "./TypeSelector"

const meta: Meta<typeof TypeSelector> = {
  title: "Features/Archive/TypeSelector",
  component: TypeSelector,
  parameters: {
    layout: "padded",
  },
  args: {
    onSelect: () => {},
  },
}

export default meta

type Story = StoryObj<typeof TypeSelector>

/** Full picker grid — no type selected yet. */
export const NoneSelected: Story = {
  args: {
    selectedId: null,
  },
}

/** Collapsed chip view — a type is already chosen. */
export const Selected: Story = {
  args: {
    selectedId: "career",
  },
}

/** Collapsed chip view — disabled so the change button is hidden. */
export const SelectedDisabled: Story = {
  args: {
    selectedId: "personal-project",
    disabled: true,
  },
}

/**
 * 확정본에서 **폐기된** 유형으로 저장해 둔 기록(FRT-300). 접힌 칩에 라벨이 그대로 뜨고,
 * '변경'을 눌러 펼치면 개인성장 그룹에 이 유형만 선택된 상태로 남는다 —
 * 다른 폐기 유형(기록·목표)은 나타나지 않는다.
 */
export const RetiredTypeSelected: Story = {
  args: {
    selectedId: "sports",
  },
}

/**
 * 확정본에서 **흡수된** 유형으로 저장해 둔 기록(FRT-291 `team-project`). 폐기형과 반대로
 * 되살리지 않는다 — 현행 '프로젝트'가 이미 같은 라벨로 목록에 있어 되살리면 칩이 두 장이 된다.
 * 대신 선택 표시가 현행 '프로젝트'로 접혀서 간다.
 */
export const AbsorbedTypeSelected: Story = {
  args: {
    selectedId: "team-project",
  },
}

/** Full picker in disabled mode — all chips greyed out except the selected one. */
export const NoneSelectedDisabled: Story = {
  args: {
    selectedId: null,
    disabled: true,
  },
}
