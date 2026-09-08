"use client";

interface Props {
  /** `meta.보류된_경험수`. 백엔드가 판정하지 않았으면 undefined 다. */
  count: number | undefined;
}

/**
 * FRT-207 — 1쪽 예산을 넘겨 이번 레쥬메에 안 실린 경험이 몇 개인지 알려준다.
 *
 * 보류는 삭제가 아니다(JSON 에는 그대로 남는다). 사용자가 "왜 그 경험이 안 보이지" 에서
 * 멈추지 않도록 **빠진 사실 자체를 화면이 먼저 말한다.**
 *
 * `undefined`(백엔드가 아직 판정 안 함)와 `0`(판정했고 보류 없음)은 다르다 — 둘 다 안 그리지만
 * 부재를 0 으로 뭉개면 나중에 판정이 들어와도 안내가 영영 안 뜬다.
 */
export function RemainingExperiencesNotice({ count }: Props) {
  if (count === undefined || count <= 0) return null;

  return (
    <div className="no-print mb-4 rounded-md border border-border bg-surface px-4 py-3">
      <p className="text-body-sm text-text-primary">
        한 장에 맞추려고 경험 {count}개는 이번 이력서에 넣지 않았어요.
      </p>
      <p className="mt-1 text-caption text-text-secondary">
        기록은 그대로 남아 있어요. 다시 만들면 다른 조합으로 채울 수 있어요.
      </p>
    </div>
  );
}
