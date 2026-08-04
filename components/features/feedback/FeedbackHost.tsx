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
import type { FeedbackContext, FeedbackPayload } from "@/lib/feedback/types";
import type { AnalysisKind } from "@/lib/analytics";
import { FeedbackModal } from "./FeedbackModal";

// FRT-95: 인앱 피드백 모달의 **결합 지점**.
//
// 부품은 이미 다 있다 — 판정은 useFeedbackPrompt(FRT-93), 표현은 FeedbackModal(FRT-94),
// 전송은 transport(FRT-92). 여기서는 흩어진 트리거 신호를 모아 "언제 띄울지"만 정한다.
//
// `(main)` 레이아웃 한 곳에만 마운트한다. 화면마다 마운트하면 이동할 때마다 prompt-shown POST
// 가 한 번씩 더 나가고(훅 주석의 경고), 트리거를 낸 화면을 벗어나는 순간 모달도 함께 사라진다.
//
// 기능 플래그는 여기서 보지 않는다. 게이트는 useFeedbackPrompt 안의 isFeedbackEnabled() 한
// 곳이다 — NEXT_PUBLIC_* 는 빌드타임에 인라인되므로 컴포넌트가 플래그를 다시 읽으면 테스트·
// 스토리북에서 이 배선을 영영 검증할 수 없게 된다(FRT-108 교훈).

const CAMPAIGN_ID = "analysis-satisfaction" as const;

/**
 * 입력 도중에는 말을 걸지 않는다(FRT-95: "절대 피하는 타이밍"). 쓰던 걸 가리는 모달은
 * 피드백을 얻기는커녕 입력을 끊는다 — ARC 원칙의 "입력 허들 최소화"와 정면으로 어긋난다.
 *
 * 분석 생성(`/analysis/*​/new`)도 같은 이유로 넣는다. 경험·키워드를 고르는 중이고, 목록에서
 * 트리거가 걸린 채 이리로 넘어오는 경로가 실제로 있다. 분석 **완료** 트리거는 생성 직후
 * 이동해 간 목록 화면에서 관측되므로(FRT-176) 여기 걸리지 않는다.
 *
 * ⚠️ 이 목록은 Host 가 들고 있는 하드코딩 allowlist다 — **입력 화면을 새로 만들면 여기도 함께
 * 고쳐야 하고, 빠뜨려도 아무 신호가 없다**. 판정 기준은 둘이다: ① 미저장 편집 상태를 들고 있는
 * 화면인가(이력서 편집기가 dirty 가드를 가진 것처럼), ② 질문이 전제하는 것을 사용자가 아직
 * 보지 못한 화면인가(분석 목록). 목록이 더 길어지면 경로를 여기서 열거하는 대신 화면이 스스로
 * "지금 말 걸지 마라"라고 선언하는 쪽(useSuppressFeedback)으로 뒤집는 게 맞다.
 */
const SUPPRESSED_PATHS = [
  /^\/archive\/new$/,
  /^\/archive\/[^/]+\/edit$/,
  /^\/analysis\/[^/]+\/new$/,
  // 분석 **목록**은 입력 화면이 아니지만 같은 취급을 한다 — 이 캠페인이 묻는 건
  // "방금 이 분석, 도움이 됐나요?" 인데, 완료는 목록에서 관측되므로(FRT-176) 여기서 띄우면
  // 아직 결과를 열어보지도 않은 사용자에게 묻게 된다. prompt-shown 은 서버가 1회로 못박는
  // **단 한 번의 기회**라, 그때 닫히면 영영 못 묻는다.
  // 억제는 신호를 버리지 않고 **보류**하므로(아래 effect), 완료 카드를 눌러 결과로 들어가는
  // 순간 그 화면 위에서 뜬다 — 대기 화면이 있던 시절과 같은 자리다.
  /^\/analysis\/(comprehensive|keyword)$/,
  // 이력서 편집기 — 저장 전 편집 상태(dirty)를 들고 있고 이탈 가드까지 있는 화면이다.
  /^\/export\/resume\/[^/]+$/,
  // 설정 = 프로필 편집 폼 한 장(ProfileEditForm 이 isDirty 를 든다). 같은 부류다.
  /^\/settings$/,
];

/**
 * 끝의 `/` 를 떼어 비교 기준을 하나로 만든다.
 *
 * next.config 가 PostHog 프록시 때문에 `skipTrailingSlashRedirect: true` 를 켜 둬서
 * `/analysis/comprehensive/` 가 정규화되지 않고 그대로 들어올 수 있다. 그러면 억제 목록도
 * 결과 경로 판정도 **조용히** 빗나간다 — 목록 위에서 단 한 번뿐인 노출 기회를 태워버리고,
 * 상세 경로에서는 엉뚱한 분석이 payload 에 남는다.
 */
function normalizePath(pathname: string | null): string | null {
  if (!pathname) return null;
  const trimmed = pathname.replace(/\/+$/, "");
  // 전부 깎여나가면(`/`, `//`) 루트다 — 빈 문자열은 "경로 없음"과 구분되지 않는다.
  return trimmed === "" ? "/" : trimmed;
}

function isSuppressedPath(pathname: string | null): boolean {
  const path = normalizePath(pathname);
  if (!path) return false;
  return SUPPRESSED_PATHS.some((re) => re.test(path));
}

/**
 * 어느 게이트가 열렸는지. 트리거 화면이 보고한 원본 신호이며, 지연이 끝나면 그대로 훅에 넘긴다.
 * 훅이 요구하는 참조 안정성을 위해 **state 에 담아** 다룬다 — 인라인 객체를 넘기면 훅의
 * 판정 effect 가 매 렌더 재실행된다(FRT-93 에서 겪은 함정).
 */
type TriggerSignal =
  | { kind: "experience"; count: number }
  | { kind: "analysis"; context: FeedbackContext };

/** 완료를 관측할 수 있는 분석 종류 = 결과 경로의 두 번째 조각. individual 은 여기 없다. */
const ANALYSIS_RESULT_KINDS: readonly AnalysisKind[] = ["comprehensive", "keyword"];

/** `/analysis/(comprehensive|keyword)/<id>` 를 보고 있으면 그 분석의 메타를 준다. */
function viewedAnalysis(pathname: string | null): FeedbackContext | null {
  const path = normalizePath(pathname);
  if (!path) return null;
  const segments = path.split("/");
  if (segments.length !== 4 || segments[1] !== "analysis") return null;
  const analysisType = ANALYSIS_RESULT_KINDS.find((k) => k === segments[2]);
  // `new` 는 생성 화면이지 분석 id 가 아니다(억제 경로라 여기까지 오지도 않지만, 오인하지 않는다).
  if (!analysisType || !segments[3] || segments[3] === "new") return null;
  return { analysisId: segments[3], analysisType };
}

/**
 * 평가 대상을 **보내는 순간** 보고 있는 결과로 확정한다.
 *
 * 완료 관측이 대기 화면에서 목록으로 옮겨지면서(FRT-176) 신호를 낸 분석과 사용자가 열어본
 * 분석이 갈릴 수 있게 됐다 — 한 번의 갱신에서 A·B 가 같이 완료되면 신호는 먼저 온 A 로
 * 고정되는데(reportAnalysisCompleted 는 덮지 않는다) 사용자는 B 를 누를 수 있다. 그대로 두면
 * "방금 이 분석"이라 물어놓고 payload 에는 A 의 id 가 실려, 어떤 결과에 대한 평가인지가 어긋난다.
 * 대기 화면 시절에는 완료 즉시 그 분석의 상세로 보냈으므로 이 어긋남 자체가 없었다.
 *
 * ⚠️ **모달이 뜨는 시점에 확정하면 안 된다.** 노출 기록(prompt-shown) 응답을 기다리는 사이나
 * 모달이 떠 있는 동안 사용자는 다른 결과로 옮겨갈 수 있고, 그러면 화면은 C 인데 평가는 B 로
 * 나간다. 별점이 실제로 어떤 결과를 가리키는지가 정해지는 건 **보내기를 누른 순간**이므로,
 * 판정도 거기서 한다.
 *
 * 결과 화면이 아니면(문서화된 트레이드오프대로 다른 화면에서 뜨는 경우) 원래 신호를 그대로 둔다.
 * 경험 도달로 뜬 응답은 분석과 무관하므로 건드리지 않는다.
 */
function attributeToViewed(
  payload: FeedbackPayload,
  pathname: string | null,
): FeedbackPayload {
  if (payload.triggerSource !== "analysis_completed") return payload;
  const viewed = viewedAnalysis(pathname);
  return viewed ? { ...payload, context: viewed } : payload;
}

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
            // 평가 대상은 여기서 확정한다 — 보내는 순간 보고 있던 결과가 정답이다.
            void submitFeedback(attributeToViewed(payload, pathname));
          }}
          onClose={close}
        />
      )}
    </FeedbackTriggerProvider>
  );
}
