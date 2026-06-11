import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { ExperienceV2 } from "@/types/archive"
import ExperienceFormV2 from "./ExperienceFormV2"
import { emptyPresetsHook } from "./__fixtures__/archive.fixtures"

/**
 * FRT-54 — 경험명(title) 빈 값 저장 차단 회귀 가드.
 *
 * 버그: handleSave 의 title 검사가 status === "draft" 에만 걸려 있어,
 * '완료'(status === "complete")로 저장하면 빈 title 경험이 저장됐다.
 * 수정: status 무관하게 빈 title 저장을 차단하고 에러 메시지를 표시한다.
 */

function renderForm(onSave = vi.fn()) {
  render(
    <ExperienceFormV2
      mode="new"
      presetsHook={emptyPresetsHook}
      onSave={onSave}
      onCancel={() => {}}
    />,
  )
  return { onSave }
}

// "대외활동" 유형 버튼은 빠른 선택·전체 그리드에 중복 렌더되므로 첫 번째를 고른다.
async function selectType(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getAllByRole("button", { name: "대외활동" })[0],
  )
}

// vitest globals:false → testing-library 자동 cleanup 미등록이므로 수동 정리.
afterEach(cleanup)

describe("FRT-54 경험명 빈 값 저장 차단", () => {
  it("'완료' 클릭 시 title 이 비어 있으면 저장이 차단되고 에러가 표시된다", async () => {
    const user = userEvent.setup()
    const { onSave } = renderForm()

    // 유형 선택 → 폼(경험명 입력·완료 버튼)이 렌더된다.
    await selectType(user)

    // title 을 비운 채 '완료' 클릭.
    await user.click(screen.getByRole("button", { name: "완료" }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText("경험명을 입력해주세요.")).toBeInTheDocument()
  })

  it("title 을 입력하면 '완료' 저장이 정상 진행된다", async () => {
    const user = userEvent.setup()
    const { onSave } = renderForm()

    await selectType(user)
    await user.type(
      screen.getByRole("textbox", { name: "경험명" }),
      "동아리 운영 경험",
    )
    await user.click(screen.getByRole("button", { name: "완료" }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({
      title: "동아리 운영 경험",
      status: "complete",
    })
  })

  // 회귀(Codex P2 #1): coreBlocks 가 비어 "경험명" 블록이 없는 레코드도, 편집 모드에서
  // 경험명 블록을 materialize 해 입력란을 기존 title 로 채워 렌더하고, 저장 시 title 을 보존한다.
  function legacyRecord(overrides: Partial<ExperienceV2> = {}): ExperienceV2 {
    return {
      id: "exp-1",
      userId: "u1",
      typeId: "extracurricular",
      title: "교내 개발 동아리 운영진",
      summary: "",
      status: "complete",
      tags: [],
      importance: undefined,
      coreBlocks: [],
      extensionBlocks: [],
      customBlocks: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    }
  }

  it("경험명 블록이 없는 편집 레코드는 입력란을 기존 title 로 채워 렌더하고 저장 시 보존한다", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <ExperienceFormV2
        mode="edit"
        initialExperience={legacyRecord()}
        presetsHook={emptyPresetsHook}
        onSave={onSave}
        onCancel={() => {}}
      />,
    )

    const titleInput = screen.getByRole("textbox", {
      name: "경험명",
    }) as HTMLInputElement
    expect(titleInput.value).toBe("교내 개발 동아리 운영진")

    await user.click(screen.getByRole("button", { name: "완료" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({
      title: "교내 개발 동아리 운영진",
      status: "complete",
    })
  })

  // 회귀(Codex P2 #2): title 까지 빈 레거시 레코드도 입력란이 렌더돼 복구 가능해야 한다.
  it("title 까지 빈 레거시 레코드는 입력란으로 복구해 저장할 수 있다", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <ExperienceFormV2
        mode="edit"
        initialExperience={legacyRecord({ title: "" })}
        presetsHook={emptyPresetsHook}
        onSave={onSave}
        onCancel={() => {}}
      />,
    )

    // 빈 채로 '완료' → 차단·에러. (이전엔 입력란이 없어 영구 차단이었음)
    await user.click(screen.getByRole("button", { name: "완료" }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText("경험명을 입력해주세요.")).toBeInTheDocument()

    // 입력란에 제목을 적어 복구 → 저장 진행.
    await user.type(screen.getByRole("textbox", { name: "경험명" }), "복구한 제목")
    await user.click(screen.getByRole("button", { name: "완료" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: "복구한 제목" })
  })
})
