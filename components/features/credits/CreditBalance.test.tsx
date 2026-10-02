import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CreditBalanceView } from "./CreditBalance";
import type { CreditsState } from "@/types/credits";

const balance = {
  balance: 50,
  reserved: 3,
  available: 47,
  updated_at: "2026-10-02T12:00:00Z",
};

const success: CreditsState = {
  data: balance,
  status: "success",
  error: null,
  isRefreshing: false,
  isStale: false,
};

afterEach(() => {
  cleanup();
});

describe.each(["summary", "compact"] as const)("CreditBalanceView — %s", (variant) => {
  it("서버 balance만 표시하고 reserved와 available은 노출하지 않는다", () => {
    render(<CreditBalanceView state={success} onRetry={() => {}} variant={variant} />);

    expect(screen.getByText("50 크레딧")).toBeVisible();
    expect(screen.queryByText(/47 크레딧|예약액|사용 가능/)).not.toBeInTheDocument();
  });

  it("0을 유효한 잔액으로 표시한다", () => {
    render(
      <CreditBalanceView
        state={{ ...success, data: { ...balance, balance: 0, reserved: 0, available: 0 } }}
        onRetry={() => {}}
        variant={variant}
      />,
    );

    expect(screen.getByText("0 크레딧")).toBeVisible();
  });

  it("첫 오류에서는 잔액을 지어내지 않고 재시도한다", () => {
    const onRetry = vi.fn();
    render(
      <CreditBalanceView
        state={{ ...success, data: null, status: "error", error: new Error("boom") }}
        onRetry={onRetry}
        variant={variant}
      />,
    );

    expect(screen.getByText("—")).toBeVisible();
    expect(screen.getByText("잔액을 불러오지 못했어요")).toBeVisible();
    expect(screen.queryByText("0 크레딧")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("첫 조회 중에는 접근성 이름이 있는 정적 스켈레톤을 표시한다", () => {
    render(
      <CreditBalanceView
        state={{ ...success, data: null, status: "loading", isRefreshing: false }}
        onRetry={() => {}}
        variant={variant}
      />,
    );

    const skeleton = screen.getByLabelText("크레딧 조회 중");
    expect(skeleton).toBeVisible();
    expect(skeleton).not.toHaveClass("animate-pulse");
    expect(screen.queryByText(/^\d.* 크레딧$/)).not.toBeInTheDocument();
  });

  it("갱신 중에는 마지막 잔액과 업데이트 상태를 표시한다", () => {
    render(
      <CreditBalanceView
        state={{ ...success, isRefreshing: true, isStale: true }}
        onRetry={() => {}}
        variant={variant}
      />,
    );

    expect(screen.getByText("50 크레딧")).toBeVisible();
    expect(screen.getByText("업데이트 중")).toBeVisible();
  });

  it("stale 오류에서는 마지막 잔액, 지연 안내, 재시도를 표시한다", () => {
    const onRetry = vi.fn();
    render(
      <CreditBalanceView
        state={{ ...success, status: "error", error: new Error("boom"), isStale: true }}
        onRetry={onRetry}
        variant={variant}
      />,
    );

    expect(screen.getByText("50 크레딧")).toBeVisible();
    expect(screen.getByText("업데이트 지연")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("조회가 진행 중이면 재시도를 비활성화한다", () => {
    render(
      <CreditBalanceView
        state={{
          ...success,
          status: "error",
          error: new Error("boom"),
          isRefreshing: true,
          isStale: true,
        }}
        onRetry={() => {}}
        variant={variant}
      />,
    );

    expect(screen.getByRole("button", { name: "다시 시도" })).toBeDisabled();
  });

  it("미제공 상태는 과거 데이터도 최신 잔액처럼 표시하지 않는다", () => {
    render(
      <CreditBalanceView
        state={{ ...success, status: "unavailable", error: new Error("not available") }}
        onRetry={() => {}}
        variant={variant}
      />,
    );

    expect(screen.getByText("—")).toBeVisible();
    expect(screen.getByText("잔액 조회를 준비 중이에요")).toBeVisible();
    expect(screen.queryByText("50 크레딧")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });
});
