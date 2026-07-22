"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  FeedbackTriggerProvider,
  type FeedbackTriggerContextValue,
} from "@/contexts/FeedbackTriggerContext";
import { useFeedbackPrompt } from "@/hooks/useFeedbackPrompt";
import {
  FEEDBACK_EXPERIENCE_THRESHOLD,
  FEEDBACK_PROMPT_DELAY_MS,
} from "@/lib/feedback/campaigns";
import { submitFeedback } from "@/lib/feedback/transport";
import type { FeedbackContext } from "@/lib/feedback/types";
import { FeedbackModal } from "./FeedbackModal";

// FRT-95: 인앱 피드백 모달의 **결합 지점**.
//
// 부품은 이미 다 있다 — 판정은 useFeedbackPrompt(FRT-93), 표현은 FeedbackModal(FRT-94),
// 전송은 transport(FRT-92). 여기서는 흩어진 트리거 신호를 모아 "언제 띄울지"만 정한다.
//
// `(main)` 레이아웃 한 곳에만 마운트한다. 화면마다 마운트하면 이동할 때마다 prompt-shown POST
// 가 한 번씩 더 나가고(훅 주석의 경고), 무엇보다 분석 완료는 그 즉시 상세로 라우팅되므로
// (useAnalysisPolling) 트리거 화면에 붙인 모달은 뜨자마자 언마운트된다.
//
// 기능 플래그는 여기서 보지 않는다. 게이트는 useFeedbackPrompt 안의 isFeedbackEnabled() 한
// 곳이다 — NEXT_PUBLIC_* 는 빌드타임에 인라인되므로 컴포넌트가 플래그를 다시 읽으면 테스트·
// 스토리북에서 이 배선을 영영 검증할 수 없게 된다(FRT-108 교훈).

const CAMPAIGN_ID = "analysis-satisfaction" as const;

/**
 * 입력 도중에는 말을 걸지 않는다(FRT-95: "절대 피하는 타이밍"). 쓰던 걸 가리는 모달은
 * 피드백을 얻기는커녕 입력을 끊는다 — ARC 원칙의 "입력 허들 최소화"와 정면으로 어긋난다.
 *
 * 분석 생성(`/analysis/*​/new`)도 같은 이유로 넣는다. 경험을 고르는 중이고, 실행 후에는 결과를
 * 기다리는 로딩 화면이다 — 목록에서 트리거가 걸린 채 이리로 넘어오는 경로가 실제로 있다.
 * 분석 **완료** 트리거는 결과 상세로 이동한 뒤에 뜨므로 여기 걸리지 않는다.
 *
 * ⚠️ 이 목록은 Host 가 들고 있는 하드코딩 allowlist다 — **입력 화면을 새로 만들면 여기도 함께
 * 고쳐야 하고, 빠뜨려도 아무 신호가 없다**. 판정 기준은 "미저장 편집 상태를 들고 있는 화면인가"
 * 하나다(이력서 편집기가 dirty 가드를 가진 것처럼). 목록이 더 길어지면 경로를 여기서 열거하는
 * 대신 화면이 스스로 "지금 입력 중"이라고 선언하는 쪽으로 뒤집는 게 맞다.
 */
const SUPPRESSED_PATHS = [
  /^\/archive\/new$/,
  /^\/archive\/[^/]+\/edit$/,
  /^\/analysis\/[^/]+\/new$/,
  // 이력서 편집기 — 저장 전 편집 상태(dirty)를 들고 있고 이탈 가드까지 있는 화면이다.
  /^\/export\/resume\/[^/]+$/,
  // 설정 = 프로필 편집 폼 한 장(ProfileEditForm 이 isDirty 를 든다). 같은 부류다.
  /^\/settings$/,
];

function isSuppressedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return SUPPRESSED_PATHS.some((re) => re.test(pathname));
}

/**
 * 어느 게이트가 열렸는지. 트리거 화면이 보고한 원본 신호이며, 지연이 끝나면 그대로 훅에 넘긴다.
 * 훅이 요구하는 참조 안정성을 위해 **state 에 담아** 다룬다 — 인라인 객체를 넘기면 훅의
 * 판정 effect 가 매 렌더 재실행된다(FRT-93 에서 겪은 함정).
 */
type TriggerSignal =
  | { kind: "experience"; count: number }
  | { kind: "analysis"; context: FeedbackContext };

export function FeedbackHost({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // pending: 트리거는 걸렸지만 아직 띄울 때가 아님 / armed: 지연도 끝나 판정에 넘긴 신호.
  const [pending, setPending] = useState<TriggerSignal | null>(null);
  const [armed, setArmed] = useState<TriggerSignal | null>(null);

  const reportExperienceCount = useCallback((count: number) => {
    if (count < FEEDBACK_EXPERIENCE_THRESHOLD) return;
    // 이미 신호가 있으면 덮지 않는다 — 목록 화면을 오갈 때마다 지연이 리셋되면 영영 안 뜬다.
    setPending((prev) => prev ?? { kind: "experience", count });
  }, []);

  const reportAnalysisCompleted = useCallback((context: FeedbackContext) => {
    // 분석 완료는 경험 도달을 덮는다. 훅의 resolvePrompt 와 같은 우선순위이며(방금 본 결과가
    // 더 구체적인 맥락), 지연도 이 시점부터 다시 센다 — 가리지 말아야 할 것이 바뀌었으므로.
    setPending((prev) =>
      prev?.kind === "analysis" ? prev : { kind: "analysis", context },
    );
  }, []);

  // 경로로는 볼 수 없는 입력 흐름(같은 URL 위에 열리는 생성 모달 등)이 스스로 올린 손들.
  const [suppressors, setSuppressors] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const setSuppressed = useCallback((key: string, active: boolean) => {
    setSuppressors((prev) => {
      if (prev.has(key) === active) return prev;
      const next = new Set(prev);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const suppressed = isSuppressedPath(pathname) || suppressors.size > 0;

  useEffect(() => {
    if (!pending || armed) return;
    // 억제 경로에서는 타이머를 걸지 않고 **보류만** 한다. 버리면 그 방문에서는 다시 기회가
    // 없다 — 경로가 바뀌면 이 effect 가 다시 돌아 그때부터 지연을 센다.
    if (suppressed) return;
    // 지연은 **지금 보고 있는 화면 기준**으로 다시 센다(deps 에 pathname). 트리거를 낸 화면에서
    // 곧바로 다른 곳으로 이동하면, 살아남은 타이머가 이제 막 열린 화면 위에 0.x초 만에 모달을
    // 띄운다 — "화면이 다 그려진 뒤에 말을 건다"는 이 지연의 존재 이유가 무너진다.
    const timer = setTimeout(() => setArmed(pending), FEEDBACK_PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending, armed, suppressed, pathname]);

  const { open, triggerSource, context, close } = useFeedbackPrompt({
    campaignId: CAMPAIGN_ID,
    experienceCount: armed?.kind === "experience" ? armed.count : null,
    analysisCompleted: armed?.kind === "analysis" ? armed.context : null,
  });

  const value = useMemo<FeedbackTriggerContextValue>(
    () => ({ reportExperienceCount, reportAnalysisCompleted, setSuppressed }),
    [reportExperienceCount, reportAnalysisCompleted, setSuppressed],
  );

  return (
    <FeedbackTriggerProvider value={value}>
      {children}
      {/* 억제는 **렌더 시점에도** 건다. 타이머를 거는 순간만 막으면, 지연이 끝나고 prompt-shown
          응답을 기다리는 사이에 입력 화면으로 넘어간 사용자에게 모달이 덮인다. open 상태는
          훅이 그대로 들고 있으므로, 입력을 마치고 벗어나면 다시 나타난다. */}
      {triggerSource && !suppressed && (
        <FeedbackModal
          open={open}
          campaignId={CAMPAIGN_ID}
          triggerSource={triggerSource}
          context={context}
          // 제출은 fire-and-forget 이다. transport 가 reject 하지 않는 것이 유일한 계약이고,
          // 사용자를 전송 완료까지 기다리게 할 이유가 없다. 모달은 onSubmit 직후 스스로 닫는다.
          onSubmit={(payload) => {
            void submitFeedback(payload);
          }}
          onClose={close}
        />
      )}
    </FeedbackTriggerProvider>
  );
}
