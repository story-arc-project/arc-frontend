import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, fn, userEvent, within } from "storybook/test"

import PreviewNav from "./PreviewNav"

const meta: Meta<typeof PreviewNav> = {
  title: "Features/Archive/PreviewNav",
  component: PreviewNav,
  parameters: {
    layout: "centered",
  },
  args: {
    onPrev: fn(),
    onNext: fn(),
  },
}

export default meta

type Story = StoryObj<typeof PreviewNav>

/**
 * 목록 한가운데 — 양쪽 다 열려 있다. 버튼과 키의 방향이 1:1이어야 하므로
 * "이전"은 위(⌃), "다음"은 아래(⌄)다.
 */
export const Both: Story = {
  args: { hasPrev: true, hasNext: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const prev = canvas.getByRole("button", { name: "이전 기록" })
    const next = canvas.getByRole("button", { name: "다음 기록" })

    await expect(prev).toBeEnabled()
    await expect(next).toBeEnabled()

    await userEvent.click(prev)
    await expect(args.onPrev).toHaveBeenCalledTimes(1)
    await expect(args.onNext).not.toHaveBeenCalled()

    await userEvent.click(next)
    await expect(args.onNext).toHaveBeenCalledTimes(1)
  },
}

/**
 * 목록 첫 항목 — 위로는 갈 곳이 없다. 순환하지 않으므로 "이전"만 잠긴다.
 * 반대쪽(다음)이 열려 있는지 함께 단언한다: 그래야 "둘 다 잠가버린" 회귀도 잡힌다.
 */
export const AtFirst: Story = {
  args: { hasPrev: false, hasNext: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const prev = canvas.getByRole("button", { name: "이전 기록" })

    await expect(prev).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "다음 기록" })).toBeEnabled()

    // 잠긴 버튼은 눌러도 이동을 호출하지 않는다.
    await userEvent.click(prev, { pointerEventsCheck: 0 })
    await expect(args.onPrev).not.toHaveBeenCalled()
  },
}

/** 목록 마지막 항목 — 아래로는 갈 곳이 없다. */
export const AtLast: Story = {
  args: { hasPrev: true, hasNext: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const next = canvas.getByRole("button", { name: "다음 기록" })

    await expect(next).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "이전 기록" })).toBeEnabled()

    await userEvent.click(next, { pointerEventsCheck: 0 })
    await expect(args.onNext).not.toHaveBeenCalled()
  },
}

/** 목록에 기록이 하나뿐이거나, 선택 항목이 필터로 목록에서 이탈한 상태. */
export const Nowhere: Story = {
  args: { hasPrev: false, hasNext: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "이전 기록" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "다음 기록" })).toBeDisabled()
  },
}
