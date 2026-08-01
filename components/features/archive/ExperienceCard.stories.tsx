import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, within } from "storybook/test"

import ExperienceCard from "./ExperienceCard"
import {
  careerExperience,
  draftExperience,
  sampleLibraries,
  customLibrary,
  uncoloredLibrary,
} from "./__fixtures__/archive.fixtures"

const meta: Meta<typeof ExperienceCard> = {
  title: "Features/Archive/ExperienceCard",
  component: ExperienceCard,
  parameters: {
    layout: "padded",
  },
  args: {
    onClick: () => {},
    onEdit: () => {},
    onDuplicate: () => {},
    onDelete: () => {},
    onMoveToLibrary: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ExperienceCard>

export const Default: Story = {
  args: {
    experience: careerExperience,
    selected: false,
    libraries: sampleLibraries,
  },
}

export const Selected: Story = {
  args: {
    experience: careerExperience,
    selected: true,
    libraries: sampleLibraries,
  },
}

export const Draft: Story = {
  args: {
    experience: draftExperience,
    selected: false,
    libraries: sampleLibraries,
  },
}

export const NoLibraries: Story = {
  args: {
    experience: careerExperience,
    selected: false,
    libraries: undefined,
  },
}

/**
 * 색 미지정 라이브러리 뱃지의 점도 토큰에서 색을 받아야 한다(FRT-128).
 * 색이 있는 뱃지를 대조군으로 함께 단언한다 — 그래야 "인라인 style 을 통째로 없애 전부
 * 회색이 된" 회귀까지 잡힌다.
 */
export const UncoloredLibraryUsesTokenFallback: Story = {
  args: {
    experience: careerExperience,
    selected: false,
    libraries: [customLibrary, uncoloredLibrary],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    function dotOf(name: string): HTMLElement {
      const badge = canvas.getByText(name).closest<HTMLElement>("span.flex")
      if (!badge) throw new Error(`library badge not found: ${name}`)
      const dot = badge.querySelector<HTMLElement>(".rounded-full")
      if (!dot) throw new Error(`library dot not found: ${name}`)
      return dot
    }

    const uncolored = dotOf(uncoloredLibrary.name)
    await expect(uncolored).toHaveClass("bg-text-secondary")
    await expect(uncolored.style.backgroundColor).toBe("")
    await expect(getComputedStyle(uncolored).backgroundColor).toBe("rgb(107, 118, 132)")

    const colored = dotOf(customLibrary.name)
    await expect(colored).not.toHaveClass("bg-text-secondary")
    await expect(getComputedStyle(colored).backgroundColor).toBe("rgb(59, 130, 246)")
  },
}

export const EmptyState: Story = {
  args: {
    experience: {
      ...careerExperience,
      id: "exp-empty",
      title: "",
      summary: "",
      tags: [],
      importance: undefined,
    },
    selected: false,
    libraries: [],
  },
}
