"use client"

// FRT-93: 인앱 피드백 모달의 **노출 판정** 훅.
//
// "지금 이 사용자에게 피드백 모달을 띄울까?" 하나만 답한다. 데이터를 가져오지 않고,
// 모달을 그리지 않으며, 응답을 전송하지도 않는다 — 트리거 신호는 호출부(FRT-95)가 넘기고,
// 표현은 FeedbackModal(FRT-94), 전송은 transport(FRT-92)가 맡는다.
//
// 판정 규칙(계약 정본 docs/feedback-campaign-contract.md):
//   노출 = ( 분석 완료 OR 경험 N개 도달 ) AND 서버가 "이번이 첫 노출"이라고 답함
//
// ⚠️ dedup 을 `getFeedbackStatus`(GET /status)로 하지 않는다. FRT-93 이슈 본문은 그렇게
// 적혀 있지만, 그 뒤 확정된 계약 정본 §3 이 명시적으로 금지한다 — GET 으로 "안 봤음"을 읽고
// POST 하면 두 탭이 동시에 has_seen=false 를 받아 둘 다 모달을 띄우는 SELECT-후-INSERT
// 레이스가 돌아온다. 판정은 `prompt-shown` 의 `created` 가 서버에서 원자적으로 내린다
// (ON CONFLICT DO NOTHING). 이 훅은 그 엔드포인트 **하나만** 호출한다.
//
// fail-closed: 조회가 실패하면(네트워크 오류 — 서버가 "이미 봤다"고 답한 게 아니라 답 자체를
// 못 받은 상태) 띄우지 않는다. 같은 모달을 두 번 보여 귀찮게 하는 것보다 한 번 놓치는 게 낫다
// (ARC 원칙: 압박 지양).
//
// 배선 시 주의(FRT-95): 판정 1회는 **마운트 수명 기준**이다. 훅을 화면마다 마운트하면 화면을
// 옮길 때마다 트리거 충족 사용자에 한해 POST 가 한 번씩 더 나간다(서버는 created=false 를
// 돌려주므로 모달이 두 번 뜨지는 않지만, 불필요한 요청이다). 트리거가 걸리는 화면들을 덮는
// 한 곳에 마운트한다.
//
// 사용 예:
//   const { open, triggerSource, context, close } = useFeedbackPrompt({
//     campaignId: "analysis-satisfaction",
//     experienceCount: experiences?.length ?? null,   // 로딩 중이면 null
//     analysisCompleted: completed,                   // 완료 전이면 null
//   })
//   // triggerSource 는 open 일 때 항상 non-null 이다.

import { useCallback, useEffect, useRef, useState } from "react"

import { markFeedbackPromptShown } from "@/lib/api/feedback-api"
import { FEEDBACK_EXPERIENCE_THRESHOLD } from "@/lib/feedback/campaigns"
import { isFeedbackEnabled } from "@/lib/feedback/flags"
import type {
  FeedbackCampaignId,
  FeedbackContext,
  FeedbackTriggerSource,
} from "@/lib/feedback/types"

interface UseFeedbackPromptOptions {
  campaignId: FeedbackCampaignId
  /**
   * 사용자의 경험 개수. **로딩 중이면 `null`** — 0 으로 접으면 안 된다. 목록이 도착하기 전의
   * "아직 모름"과 "정말 0개"는 다르고, 전자에서 판정하면 트리거가 조용히 어긋난다.
   */
  experienceCount: number | null
  /**
   * 분석이 방금 완료됐으면 그 메타, 아니면 `null`. 값이 실리는 순간이 곧 트리거다
   * (호출부가 useAnalysisPolling 의 성공 신호에서 세운다).
   */
  analysisCompleted: FeedbackContext | null
}

interface UseFeedbackPromptResult {
  /** 모달을 띄울지. 서버가 `created: true` 로 답한 뒤에만 true 가 된다. */
  open: boolean
  /** 어느 게이트로 떴는지 — 질문 문구 선택과 payload 에 그대로 쓰인다. */
  triggerSource: FeedbackTriggerSource | null
  /** 응답에 함께 실을 메타. 경험 트리거로 떴다면 분석이 없으므로 undefined 다. */
  context: FeedbackContext | undefined
  /**
   * 모달을 닫는다. 제출이든 그냥 닫기든 같은 함수를 쓴다 — 재노출 방지는 이미 서버의
   * 노출 기록이 보장하므로(계약 §3 "왜 응답이 아니라 노출을 기록하나"), 훅이 할 일은
   * 로컬 open 을 내리는 것뿐이다.
   */
  close: () => void
}

interface ResolvedPrompt {
  triggerSource: FeedbackTriggerSource
  context: FeedbackContext | undefined
}

/**
 * 충족된 게이트와 그 게이트에 딸린 컨텍스트를 함께 고른다 — 둘은 분리될 수 없다.
 * 경험 트리거로 뜬 사용자는 분석을 한 적이 없으므로 분석 컨텍스트가 **없어야** 맞고,
 * 그 규칙을 호출부가 아니라 여기서 한 번에 표현한다.
 *
 * 둘 다 충족이면 `analysis_completed` 가 이긴다 — 방금 분석 결과를 본 맥락이 더 구체적이고,
 * 질문 문구("방금 이 분석")도 그 순간에만 말이 된다.
 */
function resolvePrompt(
  analysisCompleted: FeedbackContext | null,
  experienceCount: number | null,
): ResolvedPrompt | null {
  if (analysisCompleted) {
    return { triggerSource: "analysis_completed", context: analysisCompleted }
  }
  if (
    experienceCount !== null &&
    experienceCount >= FEEDBACK_EXPERIENCE_THRESHOLD
  ) {
    return { triggerSource: "experience_threshold", context: undefined }
  }
  return null
}

export function useFeedbackPrompt({
  campaignId,
  experienceCount,
  analysisCompleted,
}: UseFeedbackPromptOptions): UseFeedbackPromptResult {
  const [prompt, setPrompt] = useState<ResolvedPrompt | null>(null)
  const [closed, setClosed] = useState(false)

  // 판정은 마운트 수명 동안 딱 한 번이다. "먼저 오는 트리거에 1회"라는 규칙이자,
  // 서버 POST 를 중복으로 쏘지 않기 위한 가드이기도 하다. 결과(띄움·차단·실패)와 무관하게
  // 한 번 판정하면 다시 묻지 않는다 — 차단된 사용자에게 트리거가 바뀔 때마다 POST 를
  // 반복하면 서버는 매번 created=false 를 돌려줄 뿐이다.
  //
  // ⚠️ 이 가드는 **캠페인을 구분하지 않는다**. 서버 dedup 키는 (user_id, campaign_id) 인데
  // 여기선 마운트당 1회다. FeedbackCampaignId 가 값 하나뿐인 지금은 같은 뜻이지만, 유니온이
  // 넓어지면 어긋난다 — 한 훅에 campaignId 를 갈아끼우면 새 캠페인은 판정되지 않고 이전
  // 캠페인의 prompt 가 그대로 열려 있게 된다. 같은 이유로 아래 resolvePrompt 는
  // campaign.triggers("이 캠페인을 띄울 수 있는 게이트들")를 읽지 않고 두 게이트를 다 본다.
  // 캠페인을 늘릴 때 이 두 가지를 함께 손봐야 한다.
  const decidedRef = useRef(false)

  useEffect(() => {
    if (decidedRef.current) return
    if (!isFeedbackEnabled()) return

    const resolved = resolvePrompt(analysisCompleted, experienceCount)
    if (!resolved) return

    // POST 를 보내기 **전에** 세운다. 이후 리렌더·StrictMode 이중 실행이 같은 요청을
    // 다시 쏘지 못하게 막는 지점이 여기다.
    decidedRef.current = true

    void (async () => {
      try {
        const { created } = await markFeedbackPromptShown(
          campaignId,
          resolved.triggerSource,
        )
        // created=false 는 이미 노출된 적 있음 — 정상 경로다(오류가 아니다).
        if (created) setPrompt(resolved)
      } catch (err) {
        // fail-closed. 조회 실패를 여기서 삼키는 건 의도적이다 — feedback-api 는 실패를
        // 정직하게 throw 하고(레이어 계약), "그래서 안 띄운다"는 판단은 이 훅의 몫이다.
        //
        // 다만 **조용히** 삼키지는 않는다. 계약 정본이 경고했듯 이 엔드포인트가 불안정하면
        // 피드백 수집이 소리 없이 0이 되고, 화면에는 아무 증상도 없어(모달이 원래 안 뜰
        // 수도 있는 기능이라) 아무도 눈치채지 못한다. 로그가 유일한 단서다.
        console.error("[feedback] prompt-shown failed", err)
      }
    })()
  }, [campaignId, experienceCount, analysisCompleted])

  const close = useCallback(() => setClosed(true), [])

  return {
    open: prompt !== null && !closed,
    triggerSource: prompt?.triggerSource ?? null,
    context: prompt?.context,
    close,
  }
}
