import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CreditBalance } from "@/components/features/credits/CreditBalance";
import { getCredits } from "@/lib/api/credits-api";
import { invalidateCredits } from "@/lib/credits/events";
import CreditsProvider from "./CreditsContext";

vi.mock("@/lib/api/credits-api", () => ({ getCredits: vi.fn() }));

const auth = vi.hoisted(() => ({
  user: { account: { email: "first@test" } } as { account: { email: string } } | null,
  isLoading: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const firstBalance = {
  balance: 50,
  reserved: 3,
  available: 47,
  updated_at: "2026-10-02T12:00:00Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { account: { email: "first@test" } };
  auth.isLoading = false;
  vi.mocked(getCredits).mockResolvedValue(firstBalance);
});

afterEach(cleanup);

it("removes the previous account balance before rendering the next account snapshot", async () => {
  const next = deferred<typeof firstBalance>();
  const view = render(
    <CreditsProvider>
      <CreditBalance variant="compact" />
    </CreditsProvider>,
  );
  await screen.findByText("50 크레딧");

  auth.user = { account: { email: "second@test" } };
  vi.mocked(getCredits).mockReturnValueOnce(next.promise);
  view.rerender(
    <CreditsProvider>
      <CreditBalance variant="compact" />
    </CreditsProvider>,
  );

  expect(screen.queryByText("50 크레딧")).not.toBeInTheDocument();
  expect(screen.getByRole("status", { name: "크레딧 조회 중" })).toBeVisible();
  await act(async () => next.resolve({ ...firstBalance, balance: 9, reserved: 0, available: 9 }));
  await screen.findByText("9 크레딧");
  expect(screen.queryByText("50 크레딧")).not.toBeInTheDocument();
});

it("keeps the last rendered balance visible through refresh and delayed failure", async () => {
  const refresh = deferred<typeof firstBalance>();
  render(
    <CreditsProvider>
      <CreditBalance variant="compact" />
    </CreditsProvider>,
  );
  await screen.findByText("50 크레딧");
  vi.mocked(getCredits).mockReturnValueOnce(refresh.promise);

  act(() => invalidateCredits());
  await waitFor(() => expect(screen.getByText("업데이트 중")).toBeVisible());
  expect(screen.getByText("50 크레딧")).toBeVisible();

  await act(async () => refresh.reject(new Error("offline")));
  await waitFor(() => expect(screen.getByText("업데이트 지연")).toBeVisible());
  expect(screen.getByText("50 크레딧")).toBeVisible();
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeVisible();
});
