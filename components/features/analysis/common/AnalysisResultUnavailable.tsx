"use client";

import Link from "next/link";
import type { AnalysisStatus } from "@/types/analysis";
import type { AnalysisKind } from "@/lib/analytics";
import RetryAnalysisButton from "./RetryAnalysisButton";

interface AnalysisResultUnavailableProps {
  /** 엔벨로프의 분석 상태. 이 값이 안내 문구를 가른다. */
  status: AnalysisStatus;
  /** 데모/로컬 basePath (없으면 ""). 목록 링크 앞에 그대로 붙는다. */
  basePath: string;
  /** 분석 유형별 목록 경로("/analysis/individual" 등). */
  fallbackHref: string;
  analysisId: string;
  /** 재시도 API가 있는 유형(종합·키워드)만 지정한다. 개별은 재시도 엔드포인트가 없다. */
  analysisType?: AnalysisKind;
  /**
   * 재시도 버튼 노출 여부. 기능 플래그 평가는 호출부가 한다 —
   * `NEXT_PUBLIC_*` 는 빌드타임 인라인이라 컴포넌트 안에 넣으면 Storybook 에서 영영
   * 렌더되지 않는다(FRT-108, RetryAnalysisButton 과 같은 결).
   */
  canRetry?: boolean;
  /** 재시도가 접수되면 호출된다. 호출부는 화면을 '진행 중'으로 낙관 갱신한다. */
  onRetried?: () => void;
}

/**
 * 결과 본문이 아직(혹은 끝내) 오지 않았을 때 보여주는 안내(FRT-134).
 *
 * 이전에는 이 경우 헤더와 구분선만 남은 빈 화면이 떴다 — 분석이 실패한 건지, 진행 중인 건지,
 * 앱이 깨진 건지 사용자가 구분할 방법이 없었다. 상태별로 지금 무슨 일이 일어나는지와
 * 다음 행동을 함께 보여준다.
 *
 * 문구는 목록 화면의 표현("분석 진행 중...", "분석에 실패했습니다")과 맞춘다.
 */
export default function AnalysisResultUnavailable({
  status,
  basePath,
  fallbackHref,
  analysisId,
  analysisType,
  canRetry = false,
  onRetried,
}: AnalysisResultUnavailableProps) {
  const showRetry = status === "failed" && canRetry && analysisType !== undefined;
  const { headline, detail } = messageFor(status, showRetry);
  // 기존 상세 화면의 error 분기와 같은 규칙: 데모(basePath 있음)면 유형별 목록 라우트가
  // 없어(app/demo/analysis 아래엔 [analysisId] 만 존재) /demo/analysis 허브로 보낸다.
  // fallbackHref(유형별 목록)는 basePath 가 없을 때만 쓴다 — 안 그러면 데모에서 404 다.
  const listHref = basePath ? `${basePath}/analysis` : fallbackHref;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div
        className="max-w-4xl mx-auto flex flex-col items-center justify-center py-16 text-center"
        role="alert"
      >
        <p className="text-body text-text-secondary mb-1">{headline}</p>
        <p className="text-body-sm text-text-tertiary mb-3">{detail}</p>
        {showRetry ? (
          // 실패 화면의 핵심 행동은 재시도다 — 목록 링크를 같은 강도의 버튼으로 두면
          // 둘이 경합해 다시 시도가 묻힌다. 목록은 텍스트 링크로 한 단 낮춘다.
          <>
            <RetryAnalysisButton
              analysisId={analysisId}
              analysisType={analysisType}
              onRetried={() => onRetried?.()}
            />
            <Link
              href={listHref}
              className="mt-4 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
            >
              목록으로 돌아가기
            </Link>
          </>
        ) : (
          <Link
            href={listHref}
            className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            목록으로 돌아가기
          </Link>
        )}
      </div>
    </main>
  );
}

function messageFor(
  status: AnalysisStatus,
  showRetry: boolean,
): { headline: string; detail: string } {
  if (status === "failed") {
    return {
      headline: "분석에 실패했습니다",
      // 재시도 버튼이 뜰 때만 "다시 시도"를 약속한다 — 플래그 off(현 배포 전량)·개별 분석처럼
      // 버튼이 없을 땐 없는 행동을 가리키지 않게 목록에서 다시 요청하도록 안내한다.
      detail: showRetry
        ? "결과를 만들지 못했어요. 다시 시도하면 같은 조합으로 새로 분석합니다."
        : "결과를 만들지 못했어요. 목록에서 다시 분석을 요청할 수 있어요.",
    };
  }
  if (status === "pending" || status === "processing") {
    return {
      headline: "분석이 아직 진행 중이에요",
      detail: "완료되면 목록에서 결과를 볼 수 있어요.",
    };
  }
  // completed 인데 본문이 비어 온 경우 — 정상 흐름이 아니다. 실패로 단정하지 않고
  // 다시 열어보도록 안내한다(백엔드가 뒤늦게 본문을 채우는 경우가 있다).
  return {
    headline: "결과를 표시할 수 없습니다",
    detail: "잠시 후 다시 열어봐 주세요.",
  };
}
