import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, within } from "storybook/test"

import ExperienceFormV2 from "./ExperienceFormV2"
import { careerExperience } from "./__fixtures__/archive.fixtures"
import { getTemplateForType } from "@/lib/constants/templates-v2"
import { cloneBlocks } from "@/lib/utils/block-utils"
import type { ExperienceV2, ImportanceLevel } from "@/types/archive"

const meta: Meta<typeof ExperienceFormV2> = {
  title: "Features/Archive/ExperienceFormV2",
  component: ExperienceFormV2,
  parameters: {
    layout: "padded",
  },
  args: {
    onSave: () => {},
    onCancel: () => {},
    onUnsavedChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof ExperienceFormV2>

/** New experience — no type selected yet (empty state). */
export const NewEmpty: Story = {
  args: {
    mode: "new",
    initialExperience: undefined,
  },
}

/** New experience (default). */
export const NewWithPresets: Story = {
  args: {
    mode: "new",
    initialExperience: undefined,
  },
}

/** Edit mode — pre-populated with a career experience. */
export const EditWithData: Story = {
  args: {
    mode: "edit",
    initialExperience: careerExperience,
  },
}

/**
 * 수상경력 확정본(FRT-211) — 빈 수상 기록.
 *
 * 블록을 손으로 적지 않고 **레지스트리에서 그대로 가져온다**. 편집 모드는 저장된 블록만 배치하므로
 * 손으로 적은 픽스처는 템플릿이 바뀌는 순간 조용히 낡아, 조건부 노출을 검증하려던 스토리가
 * "필드가 아예 없어서" 통과하거나 실패한다. 레지스트리를 쓰면 확정본과 항상 같은 것을 그린다.
 */
function emptyAward(): ExperienceV2 {
  const tmpl = getTemplateForType("award")
  return {
    id: "exp-award-01",
    userId: "user-story-01",
    typeId: "award",
    title: "전국 대학생 창업 경진대회 대상",
    summary: "",
    status: "complete",
    importance: 4 as ImportanceLevel,
    tags: [],
    coreBlocks: cloneBlocks(tmpl.commonCore.blocks),
    extensionBlocks: tmpl.extensions.flatMap(s => cloneBlocks(s.blocks)),
    customBlocks: [],
    hiddenKeys: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  }
}

export const AwardConfirmedSpec: Story = {
  args: { mode: "edit", initialExperience: emptyAward() },
}

/**
 * 확정본 §7 — "'개인/팀' 값이 '팀 수상'으로 시작하면 하위 역할 필드 표시".
 * 되돌렸을 때 사라지는 것까지 왕복으로 확인한다(빈 칸이므로 사라져야 한다).
 */
export const AwardTeamRoleAppears: Story = {
  args: { mode: "edit", initialExperience: emptyAward() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // 템플릿은 마운트 후 effect 로 실린다 — 폼이 그려질 때까지 기다린 뒤에 판정해야 한다.
    // 여기서 get* 을 쓰면 "아직 안 그려졌다"가 "조건대로 숨었다"로 잘못 읽힌다.
    const trigger = await canvas.findByLabelText("개인 / 팀")

    // 아무것도 안 고른 트리거 → 역할 칸은 숨어 있다.
    expect(canvas.queryByLabelText("팀에서 내가 맡은 역할")).toBeNull()

    await userEvent.selectOptions(trigger, "팀 수상 (2~5명)")
    expect(await canvas.findByLabelText("팀에서 내가 맡은 역할")).toBeInTheDocument()

    // 인원 구간이 달라도 '팀 수상' 접두어면 계속 보인다.
    await userEvent.selectOptions(trigger, "팀 수상 (6명 이상)")
    expect(canvas.getByLabelText("팀에서 내가 맡은 역할")).toBeInTheDocument()

    await userEvent.selectOptions(trigger, "개인 수상")
    expect(canvas.queryByLabelText("팀에서 내가 맡은 역할")).toBeNull()
  },
}

/**
 * 회귀(D1): 역할을 적어둔 뒤 '개인 수상'으로 바꿔도 **칸이 값과 함께 남는다**.
 * 값이 있는 필드를 감추면 화면엔 없는데 저장·AI 분석·레쥬메엔 값이 남고(무음 잔존), 감추며 값을
 * 지우면 잘못 누른 한 번에 데이터가 사라진다 — FRT-190 이 `canHideBlock` 에서 내린 결론과 같다.
 */
export const AwardTeamRoleKeepsValue: Story = {
  args: { mode: "edit", initialExperience: emptyAward() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const trigger = await canvas.findByLabelText("개인 / 팀")
    await userEvent.selectOptions(trigger, "팀 수상 (2~5명)")
    await userEvent.type(await canvas.findByLabelText("팀에서 내가 맡은 역할"), "팀장")

    await userEvent.selectOptions(trigger, "개인 수상")
    expect(canvas.getByLabelText("팀에서 내가 맡은 역할")).toHaveValue("팀장")
  },
}
