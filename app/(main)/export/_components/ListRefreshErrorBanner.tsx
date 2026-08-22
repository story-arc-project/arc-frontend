"use client";

interface ListRefreshErrorBannerProps {
  onRetry: () => void;
}

/**
 * FRT-319 — 재조회 실패를 **목록을 가리지 않고** 알린다.
 *
 * 보여줄 이전 목록이 있는데도 전체 에러 화면으로 바꾸면 사용자는 아무것도 안 했는데 자기
 * 기록이 화면에서 사라진다. 마지막으로 성공한 목록은 그대로 두고 위에 이 배너만 얹는다.
 * (보여줄 목록이 실제로 없는 첫 조회 실패는 여전히 전체 에러 화면이 맞다.)
 *
 * `role="status"` 는 목록을 지우지 않는 알림이라 polite 다 — 읽던 화면을 끊지 않는다.
 */
export function ListRefreshErrorBanner({ onRetry }: ListRefreshErrorBannerProps) {
  return (
    <div
      role="status"
      className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-caption text-text-secondary"
    >
      최신 상태를 불러오지 못했어요.
      <button
        type="button"
        onClick={onRetry}
        className="font-medium text-brand underline underline-offset-2"
      >
        다시 시도
      </button>
    </div>
  );
}
