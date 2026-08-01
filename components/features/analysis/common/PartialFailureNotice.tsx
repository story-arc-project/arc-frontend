import { analysisTypeLabel, type AnalysisType } from "@/types/analysis";

interface PartialFailureNoticeProps {
  /**
   * 무엇을 못 불러왔는지 말하는 문구. 컴포넌트가 문구를 모르는 이유는 화면마다 뒤에 붙는
   * 말이 다르기 때문이다 — 목록 화면은 "사라진 것은 아니에요", 요약 화면은 "숫자가 실제와
   * 다를 수 있어요"가 이어진다.
   */
  message: string;
  /** 없으면 '다시 시도' 버튼을 띄우지 않는다(재조회 수단이 없는 자리에 쓸 때). */
  onRetry?: () => void;
}

/**
 * 여러 소스를 병합하는 화면에서 **일부만** 실패했을 때의 안내(FRT-170·FRT-169).
 *
 * 전멸이 아니므로 화면을 통째로 에러로 바꾸지 않는다. 대신 살아남은 내용은 그대로 두고
 * 무엇이 빠졌는지만 알린다 — 이 안내가 없으면 살아남은 일부가 "전체"인 얼굴을 한다.
 */
export default function PartialFailureNotice({
  message,
  onRetry,
}: PartialFailureNoticeProps) {
  return (
    <div
      role="alert"
      className="px-4 py-3 rounded-lg border border-border bg-surface text-body-sm text-text-secondary flex items-center justify-between gap-3"
    >
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 min-h-11 sm:min-h-0 flex items-center text-label text-brand hover:text-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

/**
 * 분석 홈 요약(`getAnalysisHomeSummary`)의 부분 실패를 한 문장으로 옮긴다.
 * 실패가 없으면 null — 호출부는 이 값으로 노출 여부를 정한다.
 *
 * 목록 화면(history)과 달리 활성 탭으로 걸러내지 않는다: 이 화면의 상단 통계는 세 유형의
 * **합**이라, 키워드 실패는 종합 탭을 보는 사용자의 숫자까지 오염시킨다.
 */
export function describePartialFailure(
  failedTypes: AnalysisType[],
  experiencesFailed: boolean,
): string | null {
  const labels = [
    ...failedTypes.map((t) => analysisTypeLabel[t]),
    ...(experiencesFailed ? ["경험 목록"] : []),
  ];
  if (labels.length === 0) return null;
  return `${labels.join("·")} 정보를 불러오지 못했어요. 화면의 숫자가 실제와 다를 수 있어요.`;
}
