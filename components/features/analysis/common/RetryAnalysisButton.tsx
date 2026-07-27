"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { retryComprehensiveAnalysis, retryKeywordAnalysis } from "@/lib/api/analysis-api";
import { ANALYTICS_EVENTS, capture, type AnalysisKind } from "@/lib/analytics";
import { Button } from "@/components/ui";

interface RetryAnalysisButtonProps {
  analysisId: string;
  analysisType: AnalysisKind;
  /** 재시도 요청이 접수되면 호출된다. 호출부는 해당 항목을 진행 중 상태로 낙관적 갱신한다. */
  onRetried: () => void;
}

const retryFn: Record<AnalysisKind, (analysisId: string) => Promise<void>> = {
  comprehensive: retryComprehensiveAnalysis,
  keyword: retryKeywordAnalysis,
};

/**
 * FRT-108: 실패한 종합·키워드 분석을 원래 조합 그대로 다시 요청한다.
 *
 * ⚠️ 이 컴포넌트는 기능 플래그를 모른다(flag-agnostic — lib/feedback/transport.ts 와 같은 결).
 * 노출 게이팅은 호출부가 `isAnalysisRetryEnabled()` 로 수행한다. 플래그를 안에 넣으면
 * NEXT_PUBLIC_* 이 빌드타임 인라인이라 Storybook 에서 영영 렌더되지 않아 검증이 막힌다.
 *
 * 실패한 분석에만 쓴다. 성공한 분석을 같은 조합으로 다시 돌리는 건 재시도가 아니라
 * 새 분석이고 정상 차감 대상이다.
 */
export default function RetryAnalysisButton({
  analysisId,
  analysisType,
  onRetried,
}: RetryAnalysisButtonProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleRetry() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await retryFn[analysisType](analysisId);
    } catch {
      // 재시도 요청 자체가 실패했다 — 카드는 실패 상태로 남기고 다시 누를 수 있게 둔다.
      setFailed(true);
      return;
    } finally {
      setBusy(false);
    }

    // 여기부터는 서버가 이미 접수한 뒤다. 계측은 best-effort — PostHog 가 스토리지 오류로
    // 던져도 성공한 재시도를 실패로 뒤집으면 안 된다.
    try {
      capture(ANALYTICS_EVENTS.analysisRetried, { analysis_type: analysisType });
    } catch {
      // 계측 실패는 사용자 흐름을 막지 않는다.
    }
    onRetried();
  }

  return (
    <div className="mt-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleRetry}
        disabled={busy}
        className="min-h-11 sm:min-h-0"
      >
        <RotateCcw
          size={14}
          aria-hidden="true"
          className={busy ? "animate-spin" : undefined}
        />
        {busy ? "요청 중…" : "다시 시도"}
      </Button>
      {failed && (
        <p className="text-body-sm text-error mt-1.5" role="alert">
          다시 시도하지 못했어요. 잠시 후 한 번 더 눌러주세요.
        </p>
      )}
    </div>
  );
}
