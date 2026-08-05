import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, within } from "storybook/test"

import FormSection from "./FormSection"
import { careerExperience } from "./__fixtures__/archive.fixtures"
import { createGroupBlock, createTextField, createTextareaField } from "@/lib/utils/block-utils"
import type { Block } from "@/types/archive"

const sampleBlocks = [
  createTextField("회사명", { required: true }),
  createTextareaField("지원 동기"),
]

const meta: Meta<typeof FormSection> = {
  title: "Features/Archive/FormSection",
  component: FormSection,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof FormSection>

export const Card: Story = {
  args: { variant: "card", label: "기본 정보", sectionId: "basic", blocks: sampleBlocks },
}

export const CardOptional: Story = {
  args: {
    variant: "card",
    label: "경험 상세",
    sectionId: "detail",
    optional: true,
    description: "채울수록 분석이 정확해져요",
    blocks: sampleBlocks,
  },
}

export const Collapsible: Story = {
  args: { variant: "collapsible", label: "반복 기록", defaultCollapsed: true, blocks: sampleBlocks },
}

export const Expanded: Story = {
  args: {
    label: "핵심 정보",
    blocks: careerExperience.coreBlocks,
    defaultCollapsed: false,
    readOnly: false,
    allowAdd: true,
    allowReorder: true,
    allowDelete: true,
  },
}

export const Collapsed: Story = {
  args: {
    label: "추가 정보",
    blocks: careerExperience.extensionBlocks,
    defaultCollapsed: true,
    readOnly: false,
    allowAdd: true,
    allowReorder: true,
    allowDelete: true,
  },
}

export const ReadOnly: Story = {
  args: {
    label: "핵심 정보",
    blocks: careerExperience.coreBlocks,
    defaultCollapsed: false,
    readOnly: true,
  },
}

export const EmptyBlocks: Story = {
  args: {
    label: "커스텀 블록",
    blocks: [],
    defaultCollapsed: false,
    allowAdd: true,
  },
}

function EditableHarness({ readOnly }: { readOnly?: boolean }) {
  const section = createGroupBlock("나만의 섹션")
  const f = createTextField("메모"); if (f.value.type === "text") f.value.text = "내용"
  section.children = [f]
  const [blocks, setBlocks] = useState<Block[]>(section.children ?? [])
  const [label, setLabel] = useState(section.label)
  return (
    <FormSection
      variant="card"
      sectionId={section.id}
      label={label}
      blocks={blocks}
      readOnly={readOnly}
      editableLabel={!readOnly}
      onLabelChange={setLabel}
      onDelete={() => {}}
      allowAdd={!readOnly}
      allowReorder={!readOnly}
      allowDelete={!readOnly}
      onChange={setBlocks}
    />
  )
}

export const UserSectionEditable: Story = { render: () => <EditableHarness /> }
export const UserSectionReadOnly: Story = { render: () => <EditableHarness readOnly /> }
export const FixedCard: Story = {
  args: {
    variant: "card",
    label: "기본 정보",
    blocks: [createTextField("회사명")],
    onChange: () => {},
  },
}

// ─── FRT-190 선택 필드 숨김 ──────────────────────────────────────────────────
//
// ⚠️ 픽스처에 **안정키를 직접 부여**한다 — `createTextField`(createBlock) 는 key 를 붙이지 않고
// 키는 템플릿 조립 단계에서만 주어진다. 키 없는 블록으로 스토리를 짜면 × 를 렌더하는 분기를
// 하나도 거치지 않아, 버튼이 통째로 없어져도 스토리가 그대로 통과한다.
function keyedField(label: string, opts: { required?: boolean; text?: string } = {}): Block {
  return {
    id: `story-${label}`,
    key: `detail.${label}`,
    type: "text",
    label,
    required: opts.required,
    value: { type: "text", text: opts.text ?? "" },
  }
}

/** 기간 필드는 라벨 행 우상단에 월/일 토글을 둔다 — × 와 자리를 다투는 유일한 렌더러다. */
function keyedPeriodField(label: string): Block {
  return {
    id: `story-${label}`,
    key: `detail.${label}`,
    type: "period",
    label,
    value: { type: "period", start: "", end: "", isCurrent: false },
  }
}

function HideHarness({
  initialVisible,
  initialHidden = [],
  optional = true,
}: {
  initialVisible: Block[]
  initialHidden?: Block[]
  optional?: boolean
}) {
  const [visible, setVisible] = useState<Block[]>(initialVisible)
  const [hidden, setHidden] = useState<Block[]>(initialHidden)
  return (
    <FormSection
      variant="card"
      sectionId="detail"
      label="경험 상세"
      blocks={visible}
      hiddenBlocks={hidden}
      optional={optional}
      onHide={b => {
        setVisible(v => v.filter(x => x.id !== b.id))
        setHidden(h => [...h, b])
      }}
      onUnhide={b => {
        setHidden(h => h.filter(x => x.id !== b.id))
        setVisible(v => [...v, b])
      }}
      onChange={setVisible}
    />
  )
}

/** 빈 선택 필드엔 × 가 붙고, 값이 있거나 필수인 필드엔 안 붙는다. */
export const HidableFields: Story = {
  render: () => (
    <HideHarness
      initialVisible={[
        keyedField("배운 점"),
        keyedField("느낀 점", { text: "값이 있으면 숨길 수 없다" }),
        keyedField("경험명", { required: true }),
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByLabelText("배운 점 숨기기")).toBeInTheDocument()
    expect(canvas.queryByLabelText("느낀 점 숨기기")).toBeNull()
    expect(canvas.queryByLabelText("경험명 숨기기")).toBeNull()
  },
}

/** 숨겼다가 되살리는 왕복. */
export const HideAndRestore: Story = {
  render: () => <HideHarness initialVisible={[keyedField("배운 점"), keyedField("협업 방식")]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByLabelText("배운 점 숨기기"))
    expect(canvas.queryByLabelText("배운 점 숨기기")).toBeNull()

    await userEvent.click(canvas.getByRole("button", { name: /숨긴 항목 1개/ }))
    await userEvent.click(canvas.getByLabelText("배운 점 다시 보기"))
    expect(canvas.getByLabelText("배운 점 숨기기")).toBeInTheDocument()
  },
}

/**
 * 회귀: 선택 필드를 전부 숨겨도 카드와 되살리기 토글이 남아야 한다.
 * 숨김을 카드 모델에서 걸러내면 `blocks.length === 0` 으로 카드째 사라져 되돌릴 길이 없어진다.
 */
export const AllHidden: Story = {
  render: () => (
    <HideHarness initialVisible={[]} initialHidden={[keyedField("배운 점"), keyedField("느낀 점")]} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText("경험 상세")).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: /숨긴 항목 2개/ })).toBeInTheDocument()
  },
}

/**
 * 회귀: × 가 생겨도 **어떤 입력칸도 폭을 잃지 않고**, × 자신은 **블록 안에 머문다**.
 *
 * 폭 대조군이 두 겹이라야 한다. ①한 카드 안에서 × 유무로 폭이 갈리지 않을 것, ②그리고 그 폭이
 * **숨김 기능을 끈 카드와 같을 것**. ②가 없으면 "× 자리를 모든 블록에 예약해서 전부 똑같이
 * 좁아진" 상태가 ①만으로 통과한다 — 정렬은 맞지만 폼 전체가 전보다 좁아진 회귀다.
 *
 * ③은 방향이 반대인 회귀를 막는다. 폭만 지키려고 × 를 카드 여백 밖(`-right-5`)으로 밀면
 * ①②는 통과하는데 버튼이 **카드 테두리에 몰려 보인다**. × 는 입력칸 오른쪽 끝 안쪽에 있어야 한다.
 * 폭·위치는 클래스 단언으로 안 잡히므로 좌표로 실측한다.
 */
export const HideButtonCostsNoWidth: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <HideHarness
        initialVisible={[keyedField("경험명", { required: true }), keyedField("배운 점")]}
      />
      {/* 대조군: 숨김을 아예 안 켠 같은 카드 = "이전 폭" */}
      <FormSection
        variant="card"
        sectionId="detail"
        label="숨김 없는 카드"
        blocks={[keyedField("협업 방식")]}
        onChange={() => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // × 가 실제로 한쪽에만 붙은 상태인지부터 확인한다(안 붙었으면 폭 비교가 무의미).
    expect(canvas.getByLabelText("배운 점 숨기기")).toBeInTheDocument()
    expect(canvas.queryByLabelText("경험명 숨기기")).toBeNull()

    // ⚠️ `getByLabelText(/배운 점/)` 은 × 버튼의 aria-label("배운 점 숨기기")까지 잡는다.
    // 입력칸만 재려면 role 로 좁힌다.
    const required = canvas.getByRole("textbox", { name: /경험명/ }).getBoundingClientRect()
    const hidable = canvas.getByRole("textbox", { name: /배운 점/ }).getBoundingClientRect()
    const baseline = canvas.getByRole("textbox", { name: /협업 방식/ }).getBoundingClientRect()

    expect(Math.abs(required.width - hidable.width)).toBeLessThan(1)
    expect(Math.abs(required.right - hidable.right)).toBeLessThan(1)
    // 핵심: 숨김을 켠 카드의 입력칸이 안 켠 카드와 **같은 폭**이어야 한다.
    expect(Math.abs(hidable.width - baseline.width)).toBeLessThan(1)

    // ③ × 는 블록 안(입력칸 오른쪽 끝 안쪽)에 머문다 — 카드 여백으로 밀어내지 않는다.
    const hideBtn = canvas.getByLabelText("배운 점 숨기기").getBoundingClientRect()
    expect(hideBtn.right).toBeLessThanOrEqual(hidable.right + 1)
  },
}

/**
 * × 는 기간 필드의 월/일 토글을 덮지 않는다.
 *
 * 둘 다 라벨 행 우상단을 노리는데 × 가 나중에 그려져 위에 얹히므로, 겹치면 '일 단위'를 누르려던
 * 클릭이 **필드를 숨긴다** — 되돌릴 수는 있어도 사용자가 의도한 적 없는 결과다.
 */
export const HideButtonClearsPeriodToggle: Story = {
  render: () => <HideHarness initialVisible={[keyedPeriodField("학습 기간")]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const hideBtn = canvas.getByLabelText("학습 기간 숨기기").getBoundingClientRect()
    const toggle = canvas.getByRole("radiogroup", { name: "기간 단위" }).getBoundingClientRect()

    // 사각형이 한 점이라도 겹치면 위에 있는 × 가 클릭을 가져간다.
    const overlaps =
      hideBtn.left < toggle.right &&
      toggle.left < hideBtn.right &&
      hideBtn.top < toggle.bottom &&
      toggle.top < hideBtn.bottom
    expect(overlaps).toBe(false)

    // 대조군: 토글이 실제로 우상단에 있고 × 도 붙은 상태여야 이 단언이 의미가 있다.
    expect(toggle.width).toBeGreaterThan(0)
    expect(hideBtn.width).toBeGreaterThan(0)
  },
}

/**
 * 필수 필드에만 표시가 붙는다 — 선택 필드의 '선택' 뱃지는 없앴다(FRT-190).
 * 카드 헤더의 '선택' 알약은 카드 층위 표시라 남으므로, 헤더를 끄고 블록만 본다.
 */
export const RequiredMarkerOnly: Story = {
  render: () => (
    <HideHarness
      optional={false}
      initialVisible={[keyedField("경험명", { required: true }), keyedField("배운 점")]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getAllByText("필수")).toHaveLength(1)
    expect(canvas.queryByText("선택")).toBeNull()
  },
}
