"use client";

import { createContext, useContext, useEffect } from "react";

import type { FeedbackContext } from "@/lib/feedback/types";

/**
 * 인앱 피드백 모달의 **트리거 신호 배선** (FRT-95).
 *
 * 트리거가 발생하는 화면(대시보드·아카이브 목록·분석 생성)과 모달을 실제로 띄우는 곳
 * (`FeedbackHost`, `(main)` 레이아웃)은 서로 멀다. 게다가 분석 완료는 그 순간 상세 페이지로
 * 라우팅되므로(useAnalysisPolling) 트리거 화면에 모달을 두면 뜨자마자 언마운트된다.
 * 그래서 화면들은 "신호만 보고"하고, 판정·지연·표시는 레이아웃 한 곳이 맡는다.
 *
 * 화면이 **직접 fetch 하지 않는다**는 점이 중요하다. 경험 개수는 이미 목록을 불러온 화면
 * (useExperiences)이 갖고 있으므로 그 값을 넘길 뿐이다 — 레이아웃에서 useExperiences 를
 * 부르면 모든 `(main)` 화면마다 경험 목록 GET 이 한 번씩 더 나간다.
 */
export interface FeedbackTriggerContextValue {
  /**
   * 사용자의 경험 개수를 보고한다. 임계 미만이면 Host 가 무시하므로 호출부는 조건을 몰라도 된다.
   * **로딩 중에는 호출하지 않는다** — 0 은 "아직 모름"이 아니라 "정말 0개"로 읽힌다.
   */
  reportExperienceCount: (count: number) => void;
  /** 분석이 방금 완료됐음을 보고한다. context 는 응답에 함께 실릴 최소 메타(PII 금지). */
  reportAnalysisCompleted: (context: FeedbackContext) => void;
}

/** provider 밖(스토리북·단위 테스트·비인증 화면)에서는 null → 소비 측이 조용히 no-op. */
const FeedbackTriggerContext = createContext<FeedbackTriggerContextValue | null>(
  null,
);

export const FeedbackTriggerProvider = FeedbackTriggerContext.Provider;

export function useFeedbackTriggers(): FeedbackTriggerContextValue | null {
  return useContext(FeedbackTriggerContext);
}

/**
 * 경험 목록을 가진 화면이 개수를 보고하는 한 줄짜리 헬퍼. 대시보드·아카이브 목록이 같은
 * effect 를 각자 복제하지 않도록 여기 둔다.
 *
 * `isLoading` 동안 보고하지 않는 게 이 함수의 존재 이유다. useFeedbackPrompt 는 "아직 모름
 * (null)"과 "정말 0개"를 구분하도록 설계돼 있는데, 로딩 중 0 을 흘리면 그 구분이 무너진다.
 */
export function useReportExperienceCount(
  count: number,
  isLoading: boolean,
): void {
  const triggers = useFeedbackTriggers();
  useEffect(() => {
    if (isLoading) return;
    triggers?.reportExperienceCount(count);
  }, [triggers, count, isLoading]);
}
