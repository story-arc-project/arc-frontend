import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import BlockRenderer from "./BlockRenderer"
import { createTextField } from "@/lib/utils/block-utils"

afterEach(cleanup)

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
