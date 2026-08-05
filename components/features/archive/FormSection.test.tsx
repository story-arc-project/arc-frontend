import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FormSection from "./FormSection"
import type { Block } from "@/types/archive"

afterEach(cleanup)

/**
 * FRT-190 선택 필드 숨김.
 *
 * ⚠️ 픽스처는 반드시 **안정키를 직접 부여**한다 — `createTextField`(createBlock) 는 key 를
 * 붙이지 않고, 키는 템플릿 조립 단계에서만 `${sectionId}.${label}` 로 주어진다. 키 없는 블록으로
 * 스토리·테스트를 짜면 × 를 렌더하는 분기를 하나도 거치지 않아, 버튼이 통째로 사라져도 통과한다.
 */
function field(label: string, opts: { key?: string; required?: boolean; text?: string } = {}): Block {
  return {
    id: `id-${label}`,
    key: opts.key ?? `detail.${label}`,
    type: "text",
    label,
    required: opts.required,
    value: { type: "text", text: opts.text ?? "" },
  }
}

describe("× 숨김 버튼 노출 조건", () => {
  it("빈 선택 필드에는 × 가 붙는다", () => {
    render(<FormSection variant="card" label="경험 상세" blocks={[field("배운 점")]} onHide={() => {}} onChange={() => {}} />)
    expect(screen.getByLabelText("배운 점 숨기기")).toBeInTheDocument()
  })

  it("값이 있는 선택 필드에는 × 가 없다 — 숨김이 무음 잔존이 되지 않게", () => {
    render(
      <FormSection
        variant="card"
        label="경험 상세"
        blocks={[field("배운 점", { text: "많이 배웠다" })]}
        onHide={() => {}}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByLabelText("배운 점 숨기기")).not.toBeInTheDocument()
  })

  it("필수 필드에는 × 가 없다", () => {
    render(
      <FormSection
        variant="card"
        label="기본 정보"
        blocks={[field("회사명", { key: "basic.회사명", required: true })]}
        onHide={() => {}}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByLabelText("회사명 숨기기")).not.toBeInTheDocument()
  })

  it("안정키 없는 사용자 블록에는 × 가 없다 — 그쪽은 영구 삭제가 따로 있다", () => {
    const block: Block = { id: "loose", type: "text", label: "메모", value: { type: "text", text: "" } }
    render(<FormSection variant="card" label="기타" blocks={[block]} onHide={() => {}} onChange={() => {}} />)
    expect(screen.queryByLabelText("메모 숨기기")).not.toBeInTheDocument()
  })

  it("onHide 를 안 넘긴 카드에는 × 가 없다 — 기존 화면 무변경", () => {
    render(<FormSection variant="card" label="경험 상세" blocks={[field("배운 점")]} onChange={() => {}} />)
    expect(screen.queryByLabelText("배운 점 숨기기")).not.toBeInTheDocument()
  })

  it("× 를 누르면 그 블록으로 onHide 가 불린다", async () => {
    const user = userEvent.setup()
    const onHide = vi.fn()
    render(<FormSection variant="card" label="경험 상세" blocks={[field("배운 점")]} onHide={onHide} onChange={() => {}} />)

    await user.click(screen.getByLabelText("배운 점 숨기기"))
    expect(onHide).toHaveBeenCalledTimes(1)
    expect(onHide.mock.calls[0][0].key).toBe("detail.배운 점")
  })

  it("readOnly 카드에는 × 가 없다", () => {
    render(
      <FormSection variant="card" label="경험 상세" readOnly blocks={[field("배운 점")]} onHide={() => {}} onChange={() => {}} />,
    )
    expect(screen.queryByLabelText("배운 점 숨기기")).not.toBeInTheDocument()
  })
})

describe("숨긴 항목 토글", () => {
  it("숨긴 항목이 없으면 토글이 없다", () => {
    render(<FormSection variant="card" label="경험 상세" blocks={[field("배운 점")]} hiddenBlocks={[]} onChange={() => {}} />)
    expect(screen.queryByText(/숨긴 항목/)).not.toBeInTheDocument()
  })

  it("숨긴 개수를 세어 보여주고, 펼치면 라벨이 나온다", async () => {
    const user = userEvent.setup()
    render(
      <FormSection
        variant="card"
        label="경험 상세"
        blocks={[field("배운 점")]}
        hiddenBlocks={[field("느낀 점"), field("협업 방식")]}
        onUnhide={() => {}}
        onChange={() => {}}
      />,
    )

    const toggle = screen.getByRole("button", { name: /숨긴 항목 2개/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("느낀 점")).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("느낀 점")).toBeInTheDocument()
    expect(screen.getByText("협업 방식")).toBeInTheDocument()
  })

  it("'다시 보기'를 누르면 그 블록으로 onUnhide 가 불린다", async () => {
    const user = userEvent.setup()
    const onUnhide = vi.fn()
    render(
      <FormSection
        variant="card"
        label="경험 상세"
        blocks={[field("배운 점")]}
        hiddenBlocks={[field("느낀 점")]}
        onUnhide={onUnhide}
        onChange={() => {}}
      />,
    )

    await user.click(screen.getByRole("button", { name: /숨긴 항목 1개/ }))
    await user.click(screen.getByLabelText("느낀 점 다시 보기"))
    expect(onUnhide).toHaveBeenCalledTimes(1)
    expect(onUnhide.mock.calls[0][0].label).toBe("느낀 점")
  })

  /**
   * 회귀: 숨김을 카드 모델(computeFormCards)에서 걸러내면 blocks.length === 0 이 되어
   * 카드가 통째로 사라지고 되살리기 경로까지 증발한다(FRT-169 와 같은 형태).
   */
  it("선택 필드를 전부 숨겨도 카드와 되살리기 토글이 남는다", () => {
    render(
      <FormSection
        variant="card"
        label="경험 상세"
        sectionId="detail"
        blocks={[]}
        hiddenBlocks={[field("배운 점"), field("느낀 점")]}
        onUnhide={() => {}}
        onChange={() => {}}
      />,
    )

    expect(screen.getByText("경험 상세")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /숨긴 항목 2개/ })).toBeInTheDocument()
  })

  it("readOnly 카드에는 숨김 토글이 없다", () => {
    render(
      <FormSection
        variant="card"
        label="경험 상세"
        readOnly
        blocks={[]}
        hiddenBlocks={[field("배운 점")]}
        onUnhide={() => {}}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByText(/숨긴 항목/)).not.toBeInTheDocument()
  })
})
