import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

import LinkBlock from "./LinkBlock"
import { uid } from "@/lib/utils/block-utils"
import type { Block, LinkBlockValue } from "@/types/archive"

// FRT-113: URL 첨부 계측만 검증한다 — posthog 자체는 client.test.ts 가 덮는다.
vi.mock("@/lib/analytics", () => ({ capture: vi.fn() }))
const { capture } = await import("@/lib/analytics")

afterEach(cleanup)
beforeEach(() => vi.mocked(capture).mockClear())

function makeLinkBlock(url = ""): Block {
  return {
    id: uid(),
    type: "link",
    label: "증빙 링크",
    value: { type: "link", url, title: "", linkType: "", description: "" },
  }
}

/** 값 변경을 부모처럼 되먹여 controlled input 이 실제로 갱신되게 렌더한다. */
function renderLinkBlock(initialUrl = "") {
  const block = makeLinkBlock(initialUrl)
  const view = render(
    <LinkBlock
      block={block}
      onChange={value => rerenderWith(value)}
    />,
  )
  function rerenderWith(value: LinkBlockValue) {
    view.rerender(
      <LinkBlock block={{ ...block, value }} onChange={v => rerenderWith(v)} />,
    )
  }
  return screen.getByPlaceholderText("https://...")
}

describe("LinkBlock URL 첨부 계측", () => {
  it("유효한 URL 을 입력하고 blur 하면 1회 발화한다", () => {
    const input = renderLinkBlock()
    fireEvent.change(input, { target: { value: "https://arc.dev/proof" } })
    fireEvent.blur(input)
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith("archive_attachment_added", {
      attachment_type: "url",
    })
  })

  it("기존 링크를 건드리지 않고 focus/blur 만 하면 발화하지 않는다", () => {
    const input = renderLinkBlock("https://arc.dev/existing")
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(capture).not.toHaveBeenCalled()
  })

  it("같은 URL 로 blur 를 반복해도 1회만 발화한다", () => {
    const input = renderLinkBlock()
    fireEvent.change(input, { target: { value: "https://arc.dev/proof" } })
    fireEvent.blur(input)
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it("URL 을 다른 값으로 바꾸면 다시 발화한다", () => {
    const input = renderLinkBlock()
    fireEvent.change(input, { target: { value: "https://arc.dev/a" } })
    fireEvent.blur(input)
    fireEvent.change(input, { target: { value: "https://arc.dev/b" } })
    fireEvent.blur(input)
    expect(capture).toHaveBeenCalledTimes(2)
  })

  it("기존 URL 을 고쳤다가 원래 값으로 되돌리면 발화하지 않는다", () => {
    // 편집 모드에서 오타를 냈다 되돌리는 흐름 — 첨부가 새로 생긴 게 아니다.
    const input = renderLinkBlock("https://arc.dev/existing")
    fireEvent.change(input, { target: { value: "https://arc.dev/exist" } })
    fireEvent.change(input, { target: { value: "https://arc.dev/existing" } })
    fireEvent.blur(input)
    expect(capture).not.toHaveBeenCalled()
  })

  it("표기만 다른 같은 URL(끝 슬래시)은 재발화하지 않는다", () => {
    const input = renderLinkBlock()
    fireEvent.change(input, { target: { value: "https://arc.dev" } })
    fireEvent.blur(input)
    fireEvent.change(input, { target: { value: "https://arc.dev/" } })
    fireEvent.blur(input)
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it("유효하지 않은 URL(입력 중 문자열·안전하지 않은 스킴)은 발화하지 않는다", () => {
    const input = renderLinkBlock()
    fireEvent.change(input, { target: { value: "arc.dev" } })
    fireEvent.blur(input)
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } })
    fireEvent.blur(input)
    expect(capture).not.toHaveBeenCalled()
  })

  it("URL 외 필드(제목)만 편집하고 blur 해도 발화하지 않는다", () => {
    renderLinkBlock()
    const title = screen.getByPlaceholderText("제목 (선택)")
    fireEvent.change(title, { target: { value: "발표 자료" } })
    fireEvent.blur(title)
    expect(capture).not.toHaveBeenCalled()
  })
})
