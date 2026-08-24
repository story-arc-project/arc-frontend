import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import ImagePreview from "./ImagePreview"

afterEach(cleanup)

describe("ImagePreview", () => {
  it("flex-col 부모 안에서 카드가 가로로 늘어나지 않도록 자기 폭만 차지한다", () => {
    // FileBlock 이 `flex flex-col` 로 감싸므로 inline-block 만으로는 stretch 되어
    // 이미지 옆에 긴 회색 여백이 남는다. self-start 로 stretch 를 막아야 한다.
    render(<ImagePreview name="a.jpg" url="https://example.com/a.jpg" />)
    const figure = screen.getByRole("figure")
    expect(figure.className.split(" ")).toContain("self-start")
  })
})
