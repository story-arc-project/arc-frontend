import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, within } from "storybook/test"
import { useRef, useState } from "react"

import OutcomeList from "./OutcomeList"
import { ProjectLinkProvider, type ProjectLinkContextValue } from "@/contexts/ProjectLinkContext"
import type { Block, RepeatableCellBlockValue } from "@/types/archive"

const meta: Meta<typeof OutcomeList> = {
  title: "Features/Archive/Blocks/OutcomeList",
  component: OutcomeList,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof OutcomeList>

function makeBlock(items: string[]): Block {
  return {
    id: "outcome-team",
    type: "repeatable-cell",
    label: "단체 활동 / 성과",
    variant: "outcome-list",
    guide: "팀·학회가 함께 이뤄낸 것들을 떠올려보세요. 수상, 발간, 대회 참가 등 무엇이든 괜찮아요.",
    value: {
      type: "repeatable-cell",
      columns: [
        { key: "item", label: "활동 / 성과", blockType: "text", placeholder: "예: 전국 케이스 경진대회 은상 수상" },
      ],
      rows: items.map((t, i) => ({ id: `row-${i}`, cells: { item: t } })),
    },
  }
}

/** 부모가 값을 소유하는 실제 사용을 재현(상호작용이 누적되도록). */
function Interactive({ initial, readOnly }: { initial: string[]; readOnly?: boolean }) {
  const [block, setBlock] = useState<Block>(() => makeBlock(initial))
  return (
    <OutcomeList
      block={block}
      readOnly={readOnly}
      onChange={(v: RepeatableCellBlockValue) => setBlock((b) => ({ ...b, value: v }))}
    />
  )
}

/**
 * 빈 상태 — 바로 쓸 수 있는 입력칸 한 줄이 미리 보인다(FRT-103).
 * 이 줄은 value(rows)에 커밋되지 않아 손대지 않고 저장하면 블록은 빈 것으로 남는다.
 */
export const Empty: Story = {
  render: () => <Interactive initial={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 빈 상태: 입력칸은 있지만 아직 데이터가 아니라 '0개 항목'이고 삭제·추가 버튼은 없다.
    const input = canvas.getByPlaceholderText("예: 전국 케이스 경진대회 은상 수상")
    expect(canvas.getByText("0개 항목")).toBeInTheDocument()
    expect(canvas.queryByRole("button", { name: /삭제/ })).toBeNull()
    expect(canvas.queryByRole("button", { name: /추가/ })).toBeNull()

    // 첫 입력으로 실체화 → 삭제·추가 버튼이 나타난다.
    await userEvent.type(input, "전국 케이스 경진대회 은상 수상")
    expect(canvas.getByText("1개 항목")).toBeInTheDocument()
    expect(canvas.getByRole("button", { name: /추가/ })).toBeInTheDocument()
    // 리마운트 없이 같은 인풋을 계속 쓴다(포커스·한글 IME 조합 보존).
    expect(canvas.getByPlaceholderText("예: 전국 케이스 경진대회 은상 수상")).toBe(input)
  },
}

/** 값이 있는 상태 — 각 행이 `• 텍스트 + ×`. */
export const WithItems: Story = {
  render: () => <Interactive initial={["전국 케이스 경진대회 은상 수상", "학회 저널 2호 공동 발간"]} />,
}

/** 상세뷰(readOnly) — 개조식 불릿 목록으로 렌더. */
export const ReadOnly: Story = {
  render: () => <Interactive initial={["전국 케이스 경진대회 은상 수상", "학회 저널 2호 공동 발간"]} readOnly />,
}

// ── FRT-76: '프로젝트로 연결' 링크 변형 ──────────────────────────────
function makeLinkBlock(items: string[]): Block {
  const base = makeBlock(items)
  return {
    ...base,
    linkConfig: { targetSectionId: "society-projects", titleColumnKey: "name", label: "프로젝트로 연결" },
  }
}

/** 인메모리 프로젝트 목록을 흉내내는 provider — 연결하면 목록에 쌓여 '연결됨' 칩이 뜬다. */
function InteractiveWithLink({ initial }: { initial: string[] }) {
  const [block, setBlock] = useState<Block>(() => makeLinkBlock(initial))
  const projectsRef = useRef<Map<string, string>>(new Map())
  const [, force] = useState(0)

  const ctx: ProjectLinkContextValue = {
    createProjectRow: (_section, _col, text) => {
      const id = `proj-${projectsRef.current.size + 1}`
      projectsRef.current.set(id, text)
      force((n) => n + 1)
      return id
    },
    getProjectRow: (_section, id) => {
      const title = projectsRef.current.get(id)
      return title === undefined ? null : { title }
    },
    scrollToProjectRow: () => {},
  }

  return (
    <ProjectLinkProvider value={ctx}>
      <OutcomeList
        block={block}
        onChange={(v: RepeatableCellBlockValue) => setBlock((b) => ({ ...b, value: v }))}
      />
    </ProjectLinkProvider>
  )
}

/** 링크 opt-in — 각 행 옆에 '프로젝트로 연결' 버튼이 붙는다. */
export const WithProjectLink: Story = {
  render: () => <InteractiveWithLink initial={["전국 케이스 경진대회 은상 수상"]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 링크 버튼 클릭 → '연결됨' 칩으로 전환
    await userEvent.click(canvas.getByRole("button", { name: "프로젝트로 연결" }))
    expect(canvas.getByRole("button", { name: /연결됨/ })).toBeInTheDocument()
    expect(canvas.queryByRole("button", { name: "프로젝트로 연결" })).toBeNull()
    // 해제 → 다시 링크 버튼
    await userEvent.click(canvas.getByRole("button", { name: "프로젝트 연결 해제" }))
    expect(canvas.getByRole("button", { name: "프로젝트로 연결" })).toBeInTheDocument()
  },
}

/** 추가 → 타이핑 → Enter로 다음 행 → 삭제 인터랙션. */
export const AddTypeAndDelete: Story = {
  render: () => <Interactive initial={[""]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // '+ 추가'로 두 번째 행 확보
    await userEvent.click(canvas.getByRole("button", { name: /추가/ }))
    let inputs = canvas.getAllByRole("textbox")
    expect(inputs).toHaveLength(2)

    // 첫 행에 입력 후 Enter → 세 번째 행 추가
    await userEvent.type(inputs[0], "케이스 대회 은상")
    await userEvent.keyboard("{Enter}")
    inputs = canvas.getAllByRole("textbox")
    expect(inputs).toHaveLength(3)
    expect((inputs[0] as HTMLInputElement).value).toBe("케이스 대회 은상")

    // 첫 행 삭제 → 두 행만 남음
    await userEvent.click(canvas.getByRole("button", { name: /케이스 대회 은상 삭제/ }))
    expect(canvas.getAllByRole("textbox")).toHaveLength(2)
  },
}
