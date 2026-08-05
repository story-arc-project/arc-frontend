import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { ExperienceV2 } from "@/types/archive"
import ExperienceFormV2 from "./ExperienceFormV2"

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
// ⚠️ spy 해제를 테스트 본문 끝에 두면 **단언이 실패한 순간 실행되지 않아** 다음 테스트의
// spy 가 그 위에 쌓인다(호출 수가 누적돼 무관한 테스트가 같이 무너진다). afterEach 로 뺀다.
afterEach(() => vi.restoreAllMocks())

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
      hiddenKeys: [],
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

/**
 * FRT-52 — 편집 모드 진입 직후 dirty(hasUnsaved) 위양성 방지.
 *
 * 버그: edit 모드에서 initialExperience 로 coreBlocks 를 초기화하면 dirty 추적이
 * "데이터 존재 여부"만 보고 즉시 onUnsavedChange(true) 를 호출했다. 사용자가
 * 아무것도 수정하지 않아도 hasUnsaved=true 가 되어 다른 카드 클릭 시 항상 가드
 * 모달이 떴다.
 * 수정: 로드된 baseline 대비 실제 변경 여부로 dirty 를 판정한다.
 */
describe("FRT-52 편집 진입 직후 dirty 위양성 방지", () => {
  function editRecord(overrides: Partial<ExperienceV2> = {}): ExperienceV2 {
    return {
      id: "exp-edit-1",
      userId: "u1",
      typeId: "extracurricular",
      title: "교내 개발 동아리 운영진",
      summary: "12명 규모 동아리 운영",
      status: "complete",
      tags: ["리더십"],
      importance: 4,
      coreBlocks: [],
      extensionBlocks: [],
      customBlocks: [],
      hiddenKeys: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    }
  }

  it("수정 없이 편집 모드로 진입하면 hasUnsaved=true 가 보고되지 않는다", async () => {
    const onUnsavedChange = vi.fn()
    render(
      <ExperienceFormV2
        mode="edit"
        initialExperience={editRecord()}
        onSave={() => {}}
        onCancel={() => {}}
        onUnsavedChange={onUnsavedChange}
      />,
    )

    // 폼(템플릿) 로드 + 경험명 materialize 가 끝날 때까지 대기.
    expect(
      (screen.getByRole("textbox", { name: "경험명" }) as HTMLInputElement).value,
    ).toBe("교내 개발 동아리 운영진")

    // 사용자 변경이 없으므로 dirty 가 한 번도 true 로 보고되면 안 된다.
    expect(onUnsavedChange).not.toHaveBeenCalledWith(true)
  })

  it("편집 모드에서 사용자가 내용을 바꾸면 hasUnsaved=true 가 보고된다", async () => {
    const user = userEvent.setup()
    const onUnsavedChange = vi.fn()
    render(
      <ExperienceFormV2
        mode="edit"
        initialExperience={editRecord()}
        onSave={() => {}}
        onCancel={() => {}}
        onUnsavedChange={onUnsavedChange}
      />,
    )

    const titleInput = screen.getByRole("textbox", { name: "경험명" })
    await user.type(titleInput, " 보강")

    expect(onUnsavedChange).toHaveBeenLastCalledWith(true)
  })
})

/**
 * FRT-78 — Codex 리뷰 P2 두 건 회귀 가드.
 *  #1 최상위 사용자 섹션 정렬(헤더 위/아래 이동)이 동작한다.
 *  #2 레거시 loose 커스텀 블록은 '기타' 카드에서 편집(연필)이 유지된다.
 */
describe("FRT-78 사용자 섹션 정렬·loose 편집 (Codex P2)", () => {
  it("섹션 '아래로 이동'으로 최상위 섹션 순서를 바꾼다 (네비 순서에 반영)", async () => {
    const user = userEvent.setup()
    const onVisibleSectionsChange = vi.fn()
    render(
      <ExperienceFormV2
        mode="new"
        onSave={() => {}}
        onCancel={() => {}}
        onVisibleSectionsChange={onVisibleSectionsChange}
      />,
    )
    await selectType(user)

    // 최상위 '블록 추가' 버튼은 DOM 상 마지막(섹션 내부 BlockList 추가 버튼과 동명) → at(-1).
    const topAdd = () => screen.getAllByRole("button", { name: "블록 추가" }).at(-1)!
    await user.click(topAdd())
    await user.click(topAdd())

    // 두 섹션에 구분용 이름 부여.
    let names = screen.getAllByRole("textbox", { name: "섹션 이름" })
    expect(names).toHaveLength(2)
    await user.clear(names[0]); await user.type(names[0], "A")
    names = screen.getAllByRole("textbox", { name: "섹션 이름" })
    await user.clear(names[1]); await user.type(names[1], "B")

    const userOrder = () => {
      const last = onVisibleSectionsChange.mock.calls.at(-1)?.[0] ?? []
      return last.map((s: { label: string }) => s.label).filter((l: string) => l === "A" || l === "B")
    }
    expect(userOrder()).toEqual(["A", "B"])

    // 첫 섹션(A) '아래로 이동' → 순서가 [B, A] 로 바뀐다.
    await user.click(screen.getAllByRole("button", { name: "섹션 아래로 이동" })[0])
    expect(userOrder()).toEqual(["B", "A"])
  })

  it("레거시 loose 커스텀 블록은 '기타' 카드에서 편집(연필) 버튼이 노출된다", () => {
    render(
      <ExperienceFormV2
        mode="edit"
        initialExperience={{
          id: "exp-loose",
          userId: "u1",
          typeId: "extracurricular",
          title: "레거시 레코드",
          summary: "",
          status: "complete",
          tags: [],
          importance: undefined,
          coreBlocks: [],
          extensionBlocks: [],
          customBlocks: [
            { id: "loose-1", type: "text", label: "메모", value: { type: "text", text: "내용" } },
          ],
          hiddenKeys: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    )

    // 추가는 막혀도(상단 '블록 추가'만 존재) loose 블록 자체 편집은 가능해야 한다.
    expect(screen.getByRole("button", { name: "블록 편집" })).toBeInTheDocument()
  })
})

/**
 * FRT-177 — 유형별 섹션 안내 문구(SECTION_DESCRIPTION_OVERRIDES) 배선.
 * 문구가 상수에만 있고 카드에 안 걸리면 확정본 가이드가 사용자에게 도달하지 않는다.
 */
describe("FRT-177 섹션 안내 문구", () => {
  it("대외활동은 활동 상세·미션 기록·활동 증빙 카드에 확정본 안내를 보여준다", async () => {
    const user = userEvent.setup()
    renderForm()
    await selectType(user)

    expect(
      screen.getByText(/개별 미션이나 프로젝트의 세부 내용은 아래/),
    ).toBeInTheDocument()
    expect(screen.getByText(/단위별로 기록해주세요/)).toBeInTheDocument()
    expect(screen.getByText(/수료증, 위촉장, 활동 확인서/)).toBeInTheDocument()
    // 유형 문구가 공통 기본 문구를 대체한다(둘이 겹쳐 나오지 않는다).
    expect(screen.queryByText("선택 입력이에요. 채울수록 분석이 정확해져요")).toBeNull()
  })

  it("문구를 지정하지 않은 유형은 기존 공통 안내를 그대로 쓴다", async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getAllByRole("button", { name: "학회" })[0])

    expect(
      screen.getByText("선택 입력이에요. 채울수록 분석이 정확해져요"),
    ).toBeInTheDocument()
  })
})

/**
 * FRT-178 — 동아리 역할 축. '역할 이력'의 역할명이 ②·③ 태그의 선택지가 되고,
 * 이름을 고치거나 지우면 이미 붙어 있는 태그가 따라 움직인다.
 * 이 전파는 폼 최상위(RoleHistoryProvider)만 할 수 있다 — 블록은 형제를 모른다.
 */
async function selectClub(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("button", { name: "동아리/교내 단체" })[0])
}

describe("FRT-178 동아리 역할 태그 동기화", () => {
  it("동아리는 확정본 4카드와 안내 문구를 보여준다", async () => {
    const user = userEvent.setup()
    renderForm()
    await selectClub(user)

    expect(screen.getByText(/개별 이벤트나 프로젝트의 세부 내용은 아래/)).toBeInTheDocument()
    expect(screen.getByText(/정기 이벤트, 공연, 프로젝트 등을 단위별로/)).toBeInTheDocument()
    expect(screen.getByText(/임명장, 활동 확인서, 수상 내역/)).toBeInTheDocument()
    // 유형 문구가 공통 기본 문구를 대체한다(범용 확장 카드도 함께 걷힌다).
    expect(screen.queryByText("선택 입력이에요. 채울수록 분석이 정확해져요")).toBeNull()
    expect(screen.queryByText("배경/목표")).toBeNull()
  })

  it("역할 이력에 등록한 이름이 개조식 행의 선택지로 나온다", async () => {
    const user = userEvent.setup()
    renderForm()
    await selectClub(user)

    await user.click(screen.getByRole("button", { name: /역할 이력 상세 기록/ }))
    await user.type(screen.getByLabelText("역할명"), "회장")

    // ② '주요 활동 / 이벤트' 행의 칩 버튼을 연다(개조식 2종 → 칩 버튼도 2개).
    await user.click(screen.getAllByText("🏷️ 역할")[0])
    expect(screen.getAllByRole("button", { name: "회장" }).length).toBeGreaterThan(0)
  })

  it("역할명을 고치면 이미 붙어 있는 태그가 따라 바뀐다", async () => {
    const user = userEvent.setup()
    renderForm()
    await selectClub(user)

    await user.click(screen.getByRole("button", { name: /역할 이력 상세 기록/ }))
    await user.type(screen.getByLabelText("역할명"), "회장")

    await user.click(screen.getAllByText("🏷️ 역할")[0])
    await user.click(screen.getAllByRole("button", { name: "회장" })[0])
    expect(screen.getByRole("button", { name: "회장 역할 태그 해제" })).toBeInTheDocument()

    // 이력에서 이름을 바꾸고 편집을 끝내면 붙어 있던 뱃지도 새 이름이 된다.
    await user.type(screen.getByLabelText("역할명"), "단")
    await user.tab()
    expect(screen.getByRole("button", { name: "회장단 역할 태그 해제" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "회장 역할 태그 해제" })).toBeNull()
  })

  it("역할명을 지우고 새로 써도 붙어 있던 태그를 잃지 않는다", async () => {
    // 이름을 통째로 바꾸려면 지우고 다시 치는 게 보통이다. 키 입력마다 전파하면 텍스트가
    // 빈 순간 태그가 사라지고, 새 이름을 다 친 뒤엔 이어붙일 옛 이름이 없어 복구할 수 없다.
    const user = userEvent.setup()
    renderForm()
    await selectClub(user)

    await user.click(screen.getByRole("button", { name: /역할 이력 상세 기록/ }))
    await user.type(screen.getByLabelText("역할명"), "회장")

    await user.click(screen.getAllByText("🏷️ 역할")[0])
    await user.click(screen.getAllByRole("button", { name: "회장" })[0])
    expect(screen.getByRole("button", { name: "회장 역할 태그 해제" })).toBeInTheDocument()

    const input = screen.getByLabelText("역할명")
    await user.clear(input)
    await user.type(input, "부회장")
    await user.tab()

    expect(screen.getByRole("button", { name: "부회장 역할 태그 해제" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "회장 역할 태그 해제" })).toBeNull()
  })

  it("활동을 프로젝트로 기록하면 연결 제목이 역할이 아니라 프로젝트명이다", async () => {
    // ③ 표의 첫 컬럼이 역할 칩이라, 제목을 columns[0] 에서 읽으면 빈 값이거나 역할 태그가 나온다.
    // 쓰기(createProjectRow)와 같은 컬럼(titleColumnKey='name')에서 읽어야 한다.
    const user = userEvent.setup()
    renderForm()
    await selectClub(user)

    await user.type(
      screen.getByPlaceholderText("예: 2024 봄 정기 공연 / 신입 부원 모집 캠페인 기획"),
      "봄 정기 공연",
    )
    await user.click(screen.getByRole("button", { name: "프로젝트로 기록" }))

    const linked = screen.getAllByRole("button", { name: /연결됨/ })[0]
    expect(linked).toHaveAttribute("title", "봄 정기 공연")
  })

  it("역할 행을 지우면 붙어 있던 태그도 사라진다", async () => {
    const user = userEvent.setup()
    renderForm()
    await selectClub(user)

    await user.click(screen.getByRole("button", { name: /역할 이력 상세 기록/ }))
    await user.type(screen.getByLabelText("역할명"), "회장")
    await user.click(screen.getAllByText("🏷️ 역할")[0])
    await user.click(screen.getAllByRole("button", { name: "회장" })[0])
    expect(screen.getByRole("button", { name: "회장 역할 태그 해제" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "회장 삭제" }))
    expect(screen.queryByRole("button", { name: "회장 역할 태그 해제" })).toBeNull()
  })
})

/**
 * FRT-190 — 선택 필드 숨김.
 *
 * ⚠️ 이 통합 테스트가 중요한 이유: 숨김 대상 판정이 `block.key` 를 요구하는데, 키는 템플릿
 * 조립 단계에서만 부여된다(`createBlock` 은 안 붙인다). 픽스처를 손으로 만든 테스트만 있으면
 * "실제 폼에서는 × 가 하나도 안 뜨는" 상태를 통과시킬 수 있다 — 실제 템플릿으로 도달을 확인한다.
 */
describe("FRT-190 선택 필드 숨김", () => {
  /** 대외활동 템플릿의 빈 선택 필드 하나를 고른다(라벨은 확정본 기준). */
  const HIDABLE_LABEL = "지원 동기"

  it("실제 폼의 빈 선택 필드에 × 가 뜬다 — 필수 필드에는 안 뜬다", async () => {
    const user = userEvent.setup()
    renderForm()
    await selectType(user)

    expect(screen.getByLabelText(`${HIDABLE_LABEL} 숨기기`)).toBeInTheDocument()
    expect(screen.queryByLabelText("경험명 숨기기")).not.toBeInTheDocument()
  })

  it("× 를 누르면 필드가 사라지고, 되살리기 토글로 되돌릴 수 있다", async () => {
    const user = userEvent.setup()
    renderForm()
    await selectType(user)

    await user.click(screen.getByLabelText(`${HIDABLE_LABEL} 숨기기`))
    expect(screen.queryByLabelText(`${HIDABLE_LABEL} 숨기기`)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /숨긴 항목 1개/ }))
    await user.click(screen.getByLabelText(`${HIDABLE_LABEL} 다시 보기`))

    expect(screen.getByLabelText(`${HIDABLE_LABEL} 숨기기`)).toBeInTheDocument()
    expect(screen.queryByText(/숨긴 항목/)).not.toBeInTheDocument()
  })

  it("숨긴 채 저장하면 hiddenKeys 에 안정키가 실린다", async () => {
    const user = userEvent.setup()
    const { onSave } = renderForm()
    await selectType(user)

    await user.click(screen.getByLabelText(`${HIDABLE_LABEL} 숨기기`))
    await user.type(screen.getByLabelText(/경험명/), "교내 동아리")
    await user.click(screen.getByRole("button", { name: "완료" }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as ExperienceV2
    expect(saved.hiddenKeys).toHaveLength(1)
    expect(saved.hiddenKeys[0]).toContain(HIDABLE_LABEL)
  })

  /** 유형 그리드를 다시 열고 다른 유형을 고른다(유형 선택 후엔 '변경'을 눌러야 열린다). */
  async function changeType(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /변경/ }))
    await user.click(screen.getAllByRole("button", { name: "동아리/교내 단체" })[0])
  }

  it("유형을 바꾸면 숨김이 초기화된다 — 안정키가 유형 간에 겹치기 때문", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    renderForm()
    await selectType(user)

    await user.click(screen.getByLabelText(`${HIDABLE_LABEL} 숨기기`))
    expect(screen.getByRole("button", { name: /숨긴 항목 1개/ })).toBeInTheDocument()

    await changeType(user)

    expect(screen.queryByText(/숨긴 항목/)).not.toBeInTheDocument()
  })

  /**
   * 숨김도 사용자가 한 작업이다. 유형 변경은 그걸 초기화하므로 확인 없이 버리면 안 된다.
   * ⚠️ 미저장 경고(`onUnsavedChange`)는 `hiddenKeys.length > 0` 를 이미 보고 있어서,
   * 여기서 안 보면 **"나가면 경고는 뜨는데 유형은 말없이 갈아엎는"** 어긋난 상태가 된다.
   *
   * 호출 **횟수**는 단언하지 않는다 — `onRequestChange` 는 '변경' 버튼과 유형 버튼 양쪽에서
   * 불리므로 UI 구조가 바뀌면 같이 깨진다. 물어봤는가 / 안 물어봤는가만 본다.
   */
  it("숨김만 했어도 유형 변경 전에 확인을 묻는다", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    renderForm()
    await selectType(user)

    // 값은 하나도 안 넣는다 — 숨김만으로 확인이 떠야 한다.
    await user.click(screen.getByLabelText(`${HIDABLE_LABEL} 숨기기`))
    await user.click(screen.getByRole("button", { name: /변경/ }))

    expect(confirmSpy).toHaveBeenCalled()
  })

  it("확인을 취소하면 숨김이 그대로 남는다", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(false)
    renderForm()
    await selectType(user)

    await user.click(screen.getByLabelText(`${HIDABLE_LABEL} 숨기기`))
    await user.click(screen.getByRole("button", { name: /변경/ }))

    expect(screen.getByRole("button", { name: /숨긴 항목 1개/ })).toBeInTheDocument()
  })

  /** 대조군: 아무것도 안 건드렸으면 확인은 안 뜬다(모든 변경에 confirm 을 걸어버린 게 아님). */
  it("아무 작업도 없으면 유형 변경에 확인이 안 뜬다", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    renderForm()
    await selectType(user)

    await user.click(screen.getByRole("button", { name: /변경/ }))

    expect(confirmSpy).not.toHaveBeenCalled()
  })
})
