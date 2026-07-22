import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

const markFeedbackPromptShownMock = vi.fn()
vi.mock("@/lib/api/feedback-api", () => ({
  markFeedbackPromptShown: (...args: unknown[]) =>
    markFeedbackPromptShownMock(...args),
}))

import { useFeedbackPrompt } from "./useFeedbackPrompt"

const CAMPAIGN = "analysis-satisfaction" as const

/** 트리거가 하나도 충족되지 않은 기본 인자. 각 테스트가 필요한 축만 덮어쓴다. */
function baseOptions() {
  return {
    campaignId: CAMPAIGN,
    experienceCount: 0,
    analysisCompleted: null,
  }
}

/** 판정 effect 가 한 바퀴 돌 시간을 준다 — "호출되지 않았다"를 검증할 때 필요. */
async function settle() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "true")
  markFeedbackPromptShownMock.mockResolvedValue({ created: true })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useFeedbackPrompt — 차단 조건", () => {
  it("기능 플래그가 off 면 트리거가 충족돼도 조회하지 않는다", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "false")

    const { result } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: 5 }),
    )
    await settle()

    expect(markFeedbackPromptShownMock).not.toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })

  it("경험 3개 미만 & 분석 전이면 조회하지 않는다", async () => {
    const { result } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: 2 }),
    )
    await settle()

    expect(markFeedbackPromptShownMock).not.toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })

  it("경험 개수가 null(로딩 중)이면 조회하지 않는다", async () => {
    // null 은 "아직 모름" — 0 으로 접어 판정하면 로딩 중에 트리거가 확정돼 버린다.
    renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: null }),
    )
    await settle()

    expect(markFeedbackPromptShownMock).not.toHaveBeenCalled()
  })
})

describe("useFeedbackPrompt — 트리거 발동", () => {
  it("경험 3개에 도달하면 experience_threshold 로 노출된다", async () => {
    const { result } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: 3 }),
    )

    await waitFor(() => expect(result.current.open).toBe(true))
    expect(markFeedbackPromptShownMock).toHaveBeenCalledWith(
      CAMPAIGN,
      "experience_threshold",
    )
    expect(result.current.triggerSource).toBe("experience_threshold")
    // 경험 트리거로 뜬 사용자는 분석을 한 적이 없다 — 분석 컨텍스트를 실으면 안 된다.
    expect(result.current.context).toBeUndefined()
  })

  it("분석이 완료되면 analysis_completed 로 노출되고 컨텍스트가 실린다", async () => {
    const analysis = { analysisId: "a-1", analysisType: "comprehensive" as const }

    const { result } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), analysisCompleted: analysis }),
    )

    await waitFor(() => expect(result.current.open).toBe(true))
    expect(markFeedbackPromptShownMock).toHaveBeenCalledWith(
      CAMPAIGN,
      "analysis_completed",
    )
    expect(result.current.triggerSource).toBe("analysis_completed")
    expect(result.current.context).toEqual(analysis)
  })

  it("경험이 임계값을 넘어선 뒤(4개 이상)에도 발동한다", async () => {
    // 마운트 시점에 이미 초과해 있을 수 있다 — '정확히 3'이 아니라 '3 이상'이 조건이다.
    const { result } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: 7 }),
    )

    await waitFor(() => expect(result.current.open).toBe(true))
  })

  it("트리거가 나중에 충족돼도 발동한다(로딩 → 도달)", async () => {
    const { result, rerender } = renderHook(
      (props: { experienceCount: number | null }) =>
        useFeedbackPrompt({ ...baseOptions(), ...props }),
      { initialProps: { experienceCount: null as number | null } },
    )
    await settle()
    expect(markFeedbackPromptShownMock).not.toHaveBeenCalled()

    rerender({ experienceCount: 3 })

    await waitFor(() => expect(result.current.open).toBe(true))
  })
})

describe("useFeedbackPrompt — 서버 판정 존중 (dedup)", () => {
  it("created=false(이미 본 적 있음)면 띄우지 않는다", async () => {
    markFeedbackPromptShownMock.mockResolvedValue({ created: false })

    const { result } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: 3 }),
    )

    await waitFor(() => expect(markFeedbackPromptShownMock).toHaveBeenCalled())
    await settle()
    expect(result.current.open).toBe(false)
  })

  it("조회가 실패하면 띄우지 않는다(fail-closed)", async () => {
    markFeedbackPromptShownMock.mockRejectedValue(new Error("network"))

    const { result } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: 3 }),
    )

    await waitFor(() => expect(markFeedbackPromptShownMock).toHaveBeenCalled())
    await settle()
    expect(result.current.open).toBe(false)
  })
})

describe("useFeedbackPrompt — 1회 판정", () => {
  it("두 트리거가 동시에 충족돼도 조회는 1회이며 analysis_completed 가 이긴다", async () => {
    const { result } = renderHook(() =>
      useFeedbackPrompt({
        campaignId: CAMPAIGN,
        experienceCount: 5,
        analysisCompleted: { analysisId: "a-1", analysisType: "keyword" },
      }),
    )

    await waitFor(() => expect(result.current.open).toBe(true))
    expect(markFeedbackPromptShownMock).toHaveBeenCalledTimes(1)
    expect(markFeedbackPromptShownMock).toHaveBeenCalledWith(
      CAMPAIGN,
      "analysis_completed",
    )
  })

  it("판정 후 다른 트리거가 뒤늦게 와도 다시 조회하지 않는다", async () => {
    const { result, rerender } = renderHook(
      (props: { analysisCompleted: { analysisId: string } | null }) =>
        useFeedbackPrompt({ ...baseOptions(), experienceCount: 3, ...props }),
      { initialProps: { analysisCompleted: null as { analysisId: string } | null } },
    )
    await waitFor(() => expect(result.current.open).toBe(true))

    rerender({ analysisCompleted: { analysisId: "a-2" } })
    await settle()

    expect(markFeedbackPromptShownMock).toHaveBeenCalledTimes(1)
    expect(result.current.triggerSource).toBe("experience_threshold")
  })

  it("호출부가 매 렌더 새 객체를 넘겨도 조회는 1회다", async () => {
    // 실전 호출부(FRT-95)는 `analysisCompleted={{ analysisId, analysisType }}` 처럼
    // 인라인 리터럴을 넘기기 쉽다 — 참조가 매번 달라져 effect 가 매 렌더 재실행된다.
    // 판정 가드가 참조가 아니라 "이미 판정했는가"에 걸려 있어야 POST 가 새지 않는다.
    const { result, rerender } = renderHook(() =>
      useFeedbackPrompt({
        campaignId: CAMPAIGN,
        experienceCount: 5,
        analysisCompleted: { analysisId: "a-1", analysisType: "keyword" },
      }),
    )
    await waitFor(() => expect(result.current.open).toBe(true))

    rerender()
    rerender()
    rerender()
    await settle()

    expect(markFeedbackPromptShownMock).toHaveBeenCalledTimes(1)
  })

  it("응답이 도착하기 전에 리렌더가 몰려도 조회는 1회다", async () => {
    // 판정 가드를 응답 수신 후에 세우면, 첫 응답을 기다리는 사이의 리렌더가 전부 POST 를
    // 한 번씩 더 쏜다(서버는 매번 created 를 판정해야 한다).
    let resolveShown: (v: { created: boolean }) => void = () => {}
    markFeedbackPromptShownMock.mockReturnValue(
      new Promise<{ created: boolean }>((resolve) => {
        resolveShown = resolve
      }),
    )

    const { rerender } = renderHook(() =>
      useFeedbackPrompt({
        campaignId: CAMPAIGN,
        experienceCount: 5,
        analysisCompleted: { analysisId: "a-1", analysisType: "keyword" },
      }),
    )
    rerender()
    rerender()
    await settle()

    expect(markFeedbackPromptShownMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveShown({ created: true })
    })
  })

  it("리렌더가 반복돼도 조회는 1회다", async () => {
    const { result, rerender } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: 3 }),
    )
    await waitFor(() => expect(result.current.open).toBe(true))

    rerender()
    rerender()
    await settle()

    expect(markFeedbackPromptShownMock).toHaveBeenCalledTimes(1)
  })

  it("created=false 로 차단된 뒤에도 다시 조회하지 않는다", async () => {
    // 서버가 "이미 봤다"고 답했는데 트리거가 바뀔 때마다 다시 물으면 무의미한 POST 가 쌓인다.
    markFeedbackPromptShownMock.mockResolvedValue({ created: false })
    const { rerender } = renderHook(
      (props: { experienceCount: number }) =>
        useFeedbackPrompt({ ...baseOptions(), ...props }),
      { initialProps: { experienceCount: 3 } },
    )
    await waitFor(() => expect(markFeedbackPromptShownMock).toHaveBeenCalled())

    rerender({ experienceCount: 4 })
    await settle()

    expect(markFeedbackPromptShownMock).toHaveBeenCalledTimes(1)
  })

  it("조회 실패로 차단된 뒤에도 다시 조회하지 않는다", async () => {
    markFeedbackPromptShownMock.mockRejectedValue(new Error("network"))
    const { rerender } = renderHook(
      (props: { experienceCount: number }) =>
        useFeedbackPrompt({ ...baseOptions(), ...props }),
      { initialProps: { experienceCount: 3 } },
    )
    await waitFor(() => expect(markFeedbackPromptShownMock).toHaveBeenCalled())

    rerender({ experienceCount: 4 })
    await settle()

    expect(markFeedbackPromptShownMock).toHaveBeenCalledTimes(1)
  })
})

describe("useFeedbackPrompt — 닫기", () => {
  it("close() 하면 닫히고 다시 열리지 않는다", async () => {
    const { result, rerender } = renderHook(() =>
      useFeedbackPrompt({ ...baseOptions(), experienceCount: 3 }),
    )
    await waitFor(() => expect(result.current.open).toBe(true))

    act(() => result.current.close())
    expect(result.current.open).toBe(false)

    rerender()
    await settle()
    expect(result.current.open).toBe(false)
    expect(markFeedbackPromptShownMock).toHaveBeenCalledTimes(1)
  })
})
