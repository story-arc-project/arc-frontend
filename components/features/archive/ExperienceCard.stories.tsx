import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, within, userEvent } from "storybook/test"

import ExperienceCard from "./ExperienceCard"
import {
  careerExperience,
  draftExperience,
  sampleLibraries,
  customLibrary,
  uncoloredLibrary,
} from "./__fixtures__/archive.fixtures"

function cardRoot(canvasElement: HTMLElement): HTMLElement {
  const card = canvasElement.querySelector<HTMLElement>("[data-experience-id]")
  if (!card) throw new Error("experience card root not found")
  return card
}

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

/** 선택되지 않은 카드에는 accent bar 가 없다 — Selected 의 대조군(FRT-86). */
export const Default: Story = {
  args: {
    experience: careerExperience,
    selected: false,
    libraries: sampleLibraries,
  },
  play: async ({ canvasElement }) => {
    const card = cardRoot(canvasElement)
    await expect(getComputedStyle(card, "::before").content).toBe("none")

    // 배지는 알약이다 — 카드가 좁아져도 라벨이 음절 중간에서 갈리면 안 된다
    // ("인턴 및 업무 경·력"). 줄이 모자라면 알약이 통째로 다음 줄로 넘어간다.
    const badge = within(card).getByText("인턴 및 업무 경력")
    await expect(getComputedStyle(badge).whiteSpace).toBe("nowrap")
  },
}

/**
 * 선택된 카드는 좌측 accent bar 로 표시된다(FRT-86). 키보드로 훑을 때 어디에 있는지가
 * 테두리 색만으로는 약해서 더한 표시다.
 *
 * 대조군(Default)과 짝으로 단언한다 — 그래야 "before: 유틸을 통째로 지워 아무 카드에도
 * bar 가 없어진" 회귀와 "선택과 무관하게 항상 그려지는" 회귀가 모두 잡힌다.
 * data-experience-id 도 함께 확인한다: 키보드 이동 시 목록이 이 속성으로 카드를 찾아 스크롤한다.
 */
export const Selected: Story = {
  args: {
    experience: careerExperience,
    selected: true,
    libraries: sampleLibraries,
  },
  play: async ({ canvasElement }) => {
    const card = cardRoot(canvasElement)
    await expect(card.getAttribute("data-experience-id")).toBe(careerExperience.id)

    const bar = getComputedStyle(card, "::before")
    await expect(bar.content).not.toBe("none")
    await expect(bar.width).toBe("3px")
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


/** A real browser measures both portal surfaces and reaches the final library. */
export const ViewportBoundedMenus: Story = {
  args: {
    experience: careerExperience,
    selected: false,
    libraries: Array.from({ length: 40 }, (_, index) => ({
      ...customLibrary,
      id: `viewport-library-${index}`,
      name: `Viewport library ${index + 1}`,
      experienceIds: [],
    })),
  },
  decorators: [Story => <div style={{ position: "fixed", bottom: 8, right: 8, width: "min(320px, calc(100vw - 16px))" }}><Story /></div>],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const view = canvasElement.ownerDocument.defaultView!
    await userEvent.click(within(canvasElement).getByLabelText("더보기"))
    const menu = body.getByText("편집").closest<HTMLElement>("[data-archive-popover]")!
    const assertBounds = async (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect()
      await expect(bounds.top).toBeGreaterThanOrEqual(7)
      await expect(bounds.left).toBeGreaterThanOrEqual(7)
      await expect(bounds.bottom).toBeLessThanOrEqual(view.innerHeight - 7)
      await expect(bounds.right).toBeLessThanOrEqual(view.innerWidth - 7)
    }
    await assertBounds(menu)
    await userEvent.hover(body.getByText("라이브러리 이동"))
    const lastOption = body.getByRole("button", { name: "Viewport library 40" })
    const submenu = lastOption.closest<HTMLElement>("[data-archive-popover]")!
    await assertBounds(submenu)
    submenu.scrollTop = submenu.scrollHeight
    submenu.dispatchEvent(new Event("scroll"))
    await expect(lastOption).toBeVisible()
    await userEvent.click(lastOption)
    await expect(menu).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    await expect(menu).not.toBeInTheDocument()
  },
}
