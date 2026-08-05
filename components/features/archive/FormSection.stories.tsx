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
 * 회귀: × 가 붙는 블록과 안 붙는 블록의 **입력칸 폭이 같아야** 한다.
 *
 * × 자리를 숨길 수 있는 블록에만 만들면 그 블록만 좁아져, 한 카드 안에서 필드 오른쪽 끝이
 * 두 줄로 어긋난다. 폭은 클래스 단언으로 잡히지 않으므로 좌표로 실측한다 —
 * 대조군(× 없는 필수 필드)을 같이 걸지 않으면 "둘 다 좁아진" 회귀가 그대로 통과한다.
 */
export const HidableAndRequiredShareWidth: Story = {
  render: () => (
    <HideHarness
      initialVisible={[keyedField("경험명", { required: true }), keyedField("배운 점")]}
    />
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
    expect(Math.abs(required.width - hidable.width)).toBeLessThan(1)
    expect(Math.abs(required.right - hidable.right)).toBeLessThan(1)
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
