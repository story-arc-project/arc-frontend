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

// role-history 도 outcome-list 와 같은 구조다 — 전용 UI 가 입력을 **하드코딩**해(month·month·text)
// `blockType` 을 보지 않는다. 열 유형을 기간·파일로 바꾸면 그 입력을 만들 길이 없어
// FRT-213 이 없애려던 무음 폴백이 이 갈래에만 남는다.
describe("role-history 라우팅 (FRT-213)", () => {
  function roleHistoryBlock(columns: BlockColumnDef[], cells: BlockRow["cells"] = {}): Block {
    return {
      id: "b2",
      type: "repeatable-cell",
      variant: "role-history",
      label: "역할 이력",
      value: { type: "repeatable-cell", columns, rows: [{ id: "r1", cells }] },
    }
  }

  const canonical: BlockColumnDef[] = [
    { key: "start", label: "시작", blockType: "period" },
    { key: "end", label: "종료", blockType: "period" },
    { key: "role", label: "역할명", blockType: "text" },
  ]

  it("정규 형태면 역할 이력 패널로 그린다", () => {
    render(<BlockRenderer block={roleHistoryBlock(canonical)} onChange={() => {}} />)

    // 전용 패널은 컬럼 라벨을 표 머리로 그리지 않는다 — 표형 폴백과 구분되는 지점.
    expect(screen.queryByText("이전 값:")).toBeNull()
    expect(screen.getAllByRole("textbox").length).toBe(1)
  })

  it("역할명 열을 파일로 바꾸면 표형으로 폴백해 업로드 칸을 준다", () => {
    const columns = canonical.map(c => (c.key === "role" ? { ...c, blockType: "file" as const } : c))
    render(<BlockRenderer block={roleHistoryBlock(columns)} onChange={() => {}} />)

    expect(screen.getByRole("button", { name: /파일 선택/ })).toBeInTheDocument()
  })

  it("시작 열을 파일로 바꿔도 표형으로 폴백한다", () => {
    const columns = canonical.map(c => (c.key === "start" ? { ...c, blockType: "file" as const } : c))
    render(<BlockRenderer block={roleHistoryBlock(columns)} onChange={() => {}} />)

    expect(screen.getByRole("button", { name: /파일 선택/ })).toBeInTheDocument()
  })

  it("첨부가 남은 셀은 정규 형태여도 표형으로 폴백해 안내를 띄운다", () => {
    render(
      <BlockRenderer
        block={roleHistoryBlock(canonical, {
          role: { type: "file", fileId: "f1", fileName: "역할표.pdf" },
        })}
        onChange={() => {}}
      />,
    )

    expect(screen.getByText(/이전 값: 역할표\.pdf/)).toBeInTheDocument()
  })
})

/**
 * FRT-190: 표시를 '선택'에서 '필수'로 뒤집었다. 선택 필드에 붙던 '선택' 뱃지는 없애고,
 * 필수 필드의 라벨 옆에만 주황 점(`RequiredDot`)을 그린다.
 */
describe("BlockRenderer 필수 표시", () => {
  it("필수 필드면 라벨 옆에 필수 표시가 붙는다", () => {
    const block = createTextField("회사명", { required: true })
    render(<BlockRenderer block={block} onChange={() => {}} />)
    expect(screen.getByText("필수")).toBeTruthy()
  })

  it("선택 필드에는 아무 표시도 붙지 않는다", () => {
    const block = createTextField("협업/팀")
    render(<BlockRenderer block={block} onChange={() => {}} />)
    expect(screen.queryByText("필수")).toBeNull()
  })

  it("'선택' 뱃지는 더 이상 렌더하지 않는다 — N개 항목과 겹치던 오버레이", () => {
    const block = createTextField("협업/팀")
    render(<BlockRenderer block={block} onChange={() => {}} />)
    expect(screen.queryByText("선택")).toBeNull()
  })
})

// ─── FRT-200: 손상된 저장 값이 화면을 죽이지 않는다 ──────────────────
//
// 블록 컴포넌트 13종은 모두 `block.value as XxxValue` 로 값을 단언한 뒤 프로퍼티를 역참조한다.
// 값이 깨져 있으면 그 자리에서 렌더가 죽고, 상세/편집 화면이 통째로 에러 화면으로 대체된다.
// 여기가 그 컴포넌트들의 유일한 진입점이라 관문 한 곳이 13종을 덮는다.
//
// ⚠️ 픽스처는 `as unknown as` 로 타입 안전망을 우회한다 — 타입이 허용하는 리터럴로만 쓰면
// 컴파일러가 그 입력을 막아 결함을 재현하지 못한다.

describe("손상된 저장 값 렌더 (FRT-200)", () => {
  function broken(type: Block["type"], value: unknown): Block {
    return { id: "b1", type, label: "손상된 칸", value: value as Block["value"] }
  }

  const CASES: [string, Block][] = [
    ["date — 값 없음", broken("date", null)],
    ["date — 날짜 결측", broken("date", { type: "date" })],
    ["text — 값 없음", broken("text", null)],
    ["textarea — 텍스트 결측", broken("textarea", { type: "textarea", text: null })],
    ["period — 종료월 결측", broken("period", { type: "period", start: "2023.01", end: null })],
    ["period — 값 없음", broken("period", null)],
    ["checklist — 선택 배열 결측", broken("checklist", { type: "checklist", checked: null })],
    ["single-select — 값 없음", broken("single-select", null)],
    ["tags — 태그 배열 결측", broken("tags", { type: "tags", tags: null })],
    ["link — url 결측", broken("link", { type: "link", url: null })],
    ["file — 값 없음", broken("file", null)],
    ["table — 행 결측", broken("table", { type: "table", columns: ["A"], rows: null })],
    ["repeatable-cell — 값 없음", broken("repeatable-cell", null)],
    ["repeatable-cell — 셀 없는 행", broken("repeatable-cell", { type: "repeatable-cell", columns: [], rows: [{ id: "r1" }] })],
  ]

  it.each(CASES)("%s — 편집 모드에서 죽지 않는다", (_label, block) => {
    expect(() => render(<BlockRenderer block={block} onChange={() => {}} />)).not.toThrow()
  })

  it.each(CASES)("%s — 상세(readOnly) 모드에서 죽지 않는다", (_label, block) => {
    expect(() =>
      render(<BlockRenderer block={block} readOnly onChange={() => {}} />),
    ).not.toThrow()
  })

  /**
   * ⚠️ **모르는 판별자 위에 편집 가능한 칸을 띄우면 안 된다.** 렌더 관문은 그릴 모양을 만들어
   * 주지만, 그게 편집 가능하면 사용자의 첫 입력이 **보존해 둔 새 스키마 값을 덮는다.**
   * 값을 지키려고 만든 폴백이 값을 지우는 통로가 된다.
   */
  it("모르는 판별자의 값은 편집 모드에서도 읽기 전용으로 그린다", () => {
    const { container } = render(
      <BlockRenderer
        block={broken("text", { type: "brand-new-in-v3", payload: "새 스키마" })}
        onChange={() => {}}
      />,
    )
    expect(container.querySelector("input, textarea, select")).toBeNull()
  })

  /**
   * ⚠️ **빈 판별자는 위 규칙의 반대편이다.** `'brand-new-in-v3'` 는 신원을 싣고 있어 지켜야
   * 하지만, `''` 는 아무것도 싣고 있지 않은 손상이다. 잠가 두면 사용자는 자기가 쓴 글자가
   * 보이지도 고쳐지지도 않는 칸을 마주한다 — 지키는 게 아니라 가두는 것이다.
   */
  it("빈 판별자의 값은 블록 타입으로 되살려 편집 가능하게 그린다", () => {
    const { container } = render(
      <BlockRenderer
        block={broken("text", { type: "", text: "저장된 값" })}
        onChange={() => {}}
      />,
    )
    const input = container.querySelector("input")
    expect(input).not.toBeNull()
    expect((input as HTMLInputElement).value).toBe("저장된 값")
    expect((input as HTMLInputElement).readOnly).toBe(false)
  })

  /**
   * ⚠️ 블록 타입은 아는 것이어도 **안쪽에 모르는 값**이 있으면 그 표는 편집 가능하면 안 된다 —
   * 셀 컨트롤이 불투명 객체를 빈 글자로 접어 그리고, 첫 입력이 그 값을 덮는다.
   */
  it("모르는 열 유형의 불투명 셀을 담은 표는 편집 칸을 열지 않는다", () => {
    const { container } = render(
      <BlockRenderer
        block={broken("repeatable-cell", {
          type: "repeatable-cell",
          columns: [{ key: "score", label: "평점", blockType: "rating-v3" }],
          rows: [{ id: "r1", cells: { score: { type: "rating-v3", value: 5 } } }],
        })}
        onChange={() => {}}
      />,
    )
    expect(container.querySelector("input, textarea, select")).toBeNull()
  })

  /**
   * "죽지 않는다"만으로는 부족하다 — 살아 있는 값을 지워 버리는 구현도 통과하기 때문이다.
   * 반만 깨진 값은 살아남은 쪽이 실제로 화면에 보여야 한다.
   */
  it("한쪽만 깨진 기간은 살아 있는 시작월을 화면에 그린다", () => {
    render(
      <BlockRenderer
        block={broken("period", { type: "period", start: "2023.01", end: null })}
        readOnly
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/2023\.01/)).toBeTruthy()
  })
})
