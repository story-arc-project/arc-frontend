"use client";

import { Button } from "@/components/ui/button";
import { useCredits } from "@/hooks/useCredits";
import type { CreditsState } from "@/types/credits";

type CreditBalanceVariant = "summary" | "compact";

interface CreditBalanceViewProps {
  state: CreditsState;
  onRetry: () => void;
  variant: CreditBalanceVariant;
}

const formatter = new Intl.NumberFormat("ko-KR");

const variantClasses: Record<CreditBalanceVariant, { value: string; detail: string }> = {
  summary: {
    value: "text-title font-semibold",
    detail: "text-body-sm",
  },
  compact: {
    value: "text-body font-semibold",
    detail: "text-caption",
  },
};

function LoadingBalance({ variant }: { variant: CreditBalanceVariant }) {
  return (
    <span
      aria-label="크레딧 조회 중"
      className={[
        "inline-block rounded bg-surface-tertiary",
        variant === "summary" ? "h-6 w-24" : "h-5 w-20",
      ].join(" ")}
    />
  );
}

export function CreditBalanceView({ state, onRetry, variant }: CreditBalanceViewProps): React.JSX.Element {
  const classes = variantClasses[variant];
  const data = state.data;
  const isUnavailable = state.status === "unavailable";
  const hasDisplayableBalance = data !== null && !isUnavailable;
  const isInitialLoading = !data && (state.status === "idle" || state.status === "loading");
  const isError = state.status === "error";

  return (
    <div className="min-w-0 text-text-primary">
      <p className="text-caption font-medium text-text-secondary">보유 크레딧</p>
      <div className="mt-0.5 min-w-0">
        {isInitialLoading ? (
          <LoadingBalance variant={variant} />
        ) : hasDisplayableBalance ? (
          <p className={`${classes.value} break-words tabular-nums`}>
            {formatter.format(data!.balance)} 크레딧
          </p>
        ) : (
          <p className={`${classes.value} tabular-nums`}>—</p>
        )}
      </div>

      {isUnavailable && (
        <p className={`mt-1 ${classes.detail} text-text-tertiary`}>
          잔액 조회를 준비 중이에요
        </p>
      )}

      {isError && !hasDisplayableBalance && (
        <p className={`mt-1 ${classes.detail} text-text-tertiary`}>
          잔액을 불러오지 못했어요
        </p>
      )}

      {hasDisplayableBalance && state.isRefreshing && (
        <p className={`mt-1 ${classes.detail} text-text-tertiary`}>업데이트 중</p>
      )}

      {hasDisplayableBalance && isError && state.isStale && !state.isRefreshing && (
        <p className={`mt-1 ${classes.detail} text-text-tertiary`}>업데이트 지연</p>
      )}

      {isError && (
        <Button
          className="mt-1 h-auto px-0 py-1 underline underline-offset-2"
          variant="ghost"
          size="sm"
          disabled={state.isRefreshing}
          onClick={onRetry}
        >
          다시 시도
        </Button>
      )}
    </div>
  );
}

export function CreditBalance({ variant }: { variant: CreditBalanceVariant }): React.JSX.Element {
  const { refetch, ...state } = useCredits();

  return (
    <CreditBalanceView
      state={state}
      onRetry={() => {
        void refetch();
      }}
      variant={variant}
    />
  );
}
