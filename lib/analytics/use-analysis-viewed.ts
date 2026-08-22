"use client";

// FRT-107: 분석 결과를 한 번 열어 본 사건.
//
// 조회 **횟수**는 이 이벤트를 세면 되고, 체류는 속성으로 함께 온다 — 정의서 권고대로
// 별도 카운터 이벤트를 만들지 않는다. 정의서가 individual_/comprehensive_/keyword_
// analysis_result_viewed 로 셋으로 나눈 것도 하나로 합치고 analysis_type 으로 가른다
// (analysis_completed·analysis_target_selected 와 같은 결).
//
// ⚠️ 한 화면이 살아 있는 동안 analysisId 가 바뀌지 않는다고 전제한다. App Router 는 경로
// 파라미터만 바뀌면 인스턴스를 재사용하는데(FRT-238), 세 결과 화면 어디에도 **다른 분석
// 결과로 가는 링크가 없어**(목록·아카이브로만 나간다) 그 경로가 성립하지 않는다. 훗날
// 이웃 결과 탐색(FRT-86 같은)이 생기면 여기서 세션을 끊어야 한다.
import { capture } from "./client";
import type { ViewableAnalysisKind } from "./events";
import { useDwell } from "./use-dwell";

export interface AnalysisViewedOptions {
  analysisType: ViewableAnalysisKind;
  analysisId: string;
  // 결과가 실제로 화면에 있는가. 불러오는 동안·실패 화면은 "본 것"이 아니다 —
  // 여기를 켜 두면 로딩 시간이 정독으로 집계된다.
  ready: boolean;
}

export function useAnalysisViewed({
  analysisType,
  analysisId,
  ready,
}: AnalysisViewedOptions): void {
  useDwell({
    active: ready,
    onLeave: (seconds) => {
      capture(
        "analysis_viewed",
        {
          analysis_type: analysisType,
          analysis_id: analysisId,
          view_duration_seconds: seconds,
        },
        // 화면이 사라지는 순간이라 배치 큐에 담으면 그대로 사라진다.
        { atUnload: true },
      );
    },
  });
}
