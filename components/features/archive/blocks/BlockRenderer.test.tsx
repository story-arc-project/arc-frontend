import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import BlockRenderer from "./BlockRenderer"
import { createTextField } from "@/lib/utils/block-utils"
import type { Block, BlockColumnDef, BlockRow } from "@/types/archive"

afterEach(cleanup)

// FRT-213: 열 유형 선택지에 기간·파일이 열리면서, 셀을 무조건 textarea 로 그리는
// outcome-list 로도 그 유형이 도달할 수 있게 됐다 — 컬럼 개수만 보는 판정으로는 못 막는다.
describe("outcome-list 라우팅 (FRT-213)", () => {
  function outcomeBlock(column: BlockColumnDef, cells: BlockRow["cells"] = {}): Block {
    return {
      id: "b1",
      type: "repeatable-cell",
      variant: "outcome-list",
      label: "핵심 성과",
      value: { type: "repeatable-cell", columns: [column], rows: [{ id: "r1", cells }] },
    }
  }

  it("텍스트 컬럼이면 개조식 목록으로 그린다", () => {
    render(
      <BlockRenderer
        block={outcomeBlock({ key: "item", label: "항목", blockType: "textarea" })}
        onChange={() => {}}
      />,
    )

    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: /현재/ })).toBeNull()
  })

  it("기간 컬럼이면 표형으로 폴백해 기간 입력을 준다", () => {
    render(
      <BlockRenderer
        block={outcomeBlock({ key: "item", label: "기간", blockType: "period" })}
        onChange={() => {}}
      />,
    )

    expect(screen.getByLabelText("기간 시작")).toHaveAttribute("type", "month")
  })

  it("파일 컬럼이면 표형으로 폴백해 업로드 칸을 준다", () => {
    render(
      <BlockRenderer
        block={outcomeBlock({ key: "item", label: "결과물", blockType: "file" })}
        onChange={() => {}}
      />,
    )

    expect(screen.getByRole("button", { name: /파일 선택/ })).toBeInTheDocument()
  })

  // 열을 파일로 바꿔 첨부를 올린 뒤 다시 텍스트로 되돌리면, 열 유형만 보는 판정은
  // 개조식 목록으로 태운다 — 거기서 첨부는 파일명 문자열로 접히고 다음 타이핑이 통째로 덮어쓴다.
  it("첨부가 남은 셀은 텍스트 컬럼이어도 표형으로 폴백해 안내를 띄운다", () => {
    render(
      <BlockRenderer
        block={outcomeBlock(
          { key: "item", label: "항목", blockType: "textarea" },
          { item: { type: "file", fileId: "f1", fileName: "보고서.pdf" } },
        )}
        onChange={() => {}}
      />,
    )

    expect(screen.getByText(/이전 값: 보고서\.pdf/)).toBeInTheDocument()
  })
})

describe("BlockRenderer 선택 뱃지", () => {
  it("showOptionalBadge + 선택 필드면 '선택' 뱃지를 렌더", () => {
    const block = createTextField("협업/팀")
    render(<BlockRenderer block={block} showOptionalBadge onChange={() => {}} />)
    expect(screen.getByText("선택")).toBeTruthy()
  })

  it("필수 필드면 뱃지를 렌더하지 않는다", () => {
    const block = createTextField("회사명", { required: true })
    render(<BlockRenderer block={block} showOptionalBadge onChange={() => {}} />)
    expect(screen.queryByText("선택")).toBeNull()
  })

  it("showOptionalBadge 없으면 뱃지 없음", () => {
    const block = createTextField("협업/팀")
    render(<BlockRenderer block={block} onChange={() => {}} />)
    expect(screen.queryByText("선택")).toBeNull()
  })
})
