import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue, AuthUser } from "@/types/auth";

const mocks = vi.hoisted(() => ({
  auth: {} as AuthContextValue,
  router: { replace: vi.fn() },
  refetch: vi.fn<() => Promise<void>>(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

import { AuthGate } from "./AuthGate";
import { FIRST_ONBOARDING_STEP } from "@/app/(auth)/constants";

const user: AuthUser = {
  account: { email: "guard@example.com", has_password: true, email_verified: true, connected_oauth: [] },
  profile: null,
  onboarded: true,
};
const protectedContent = <div>보호된 콘텐츠</div>;
const gate = () => <AuthGate>{protectedContent}</AuthGate>;

function setAuth(state: Partial<AuthContextValue>) {
  mocks.auth = { ...mocks.auth, ...state };
}
function expectHidden() {
  expect(screen.queryByText("보호된 콘텐츠")).not.toBeInTheDocument();
}
function expectNoRedirect() {
  expect(mocks.router.replace).not.toHaveBeenCalled();
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.refetch.mockResolvedValue(undefined);
  mocks.auth = {
    user: null, error: null, isLoading: false, isAuthenticated: false,
    isOnboarded: false, refetch: mocks.refetch, logout: vi.fn(),
  };
  vi.stubGlobal("location", { pathname: "/archive", search: "?id=a%2Fb&tab=notes", hash: "#private" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthGate", () => {
  it("preserves pathname and the complete search in the anonymous login callback", () => {
    render(gate());
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(
      `/login?callbackUrl=${encodeURIComponent("/archive?id=a%2Fb&tab=notes")}`,
    );
    expectHidden();
    expect(screen.getByText("불러오는 중...").closest("main")).toHaveAttribute("aria-busy", "true");
  });

  it("sends an authenticated user without onboarding to the configured first step", () => {
    setAuth({ user: { ...user, onboarded: false }, isAuthenticated: true });
    render(gate());
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(`/signup?step=${FIRST_ONBOARDING_STEP}`);
    expectHidden();
  });

  it("renders children for an authenticated onboarded user", () => {
    setAuth({ user, isAuthenticated: true, isOnboarded: true });
    render(gate());
    expect(screen.getByText("보호된 콘텐츠")).toBeVisible();
    expectNoRedirect();
  });

  it("waits for the first load before redirecting an anonymous user", () => {
    setAuth({ isLoading: true });
    const view = render(gate());
    expectHidden();
    expectNoRedirect();
    expect(screen.getByText("불러오는 중...")).toBeVisible();
    setAuth({ isLoading: false });
    view.rerender(gate());
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
    expectHidden();
  });

  it.each([false, true])("shows the initial lookup error without redirecting (loading=%s)", (isLoading) => {
    setAuth({ error: new Error("lookup failed"), isLoading });
    render(gate());
    expect(screen.getByRole("alert")).toHaveTextContent("로그인 정보를 불러오지 못했어요.");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled();
    expectHidden();
    expectNoRedirect();
  });

  it.each(["authenticated", "anonymous", "onboarding", "failed"] as const)(
    "holds the retry screen and prevents duplicate requests, then settles as %s",
    async (outcome) => {
      const pending = deferred();
      mocks.refetch.mockReturnValue(pending.promise);
      setAuth({ error: new Error("initial failure") });
      const view = render(gate());
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
      const retryButton = screen.getByRole("button", { name: "다시 시도 중..." });
      expect(retryButton).toBeDisabled();
      fireEvent.click(retryButton);
      expect(mocks.refetch).toHaveBeenCalledTimes(1);

      // AuthProvider clears error while refetch is pending. The local retry guard
      // must still hide children and suppress redirects, even before isLoading updates.
      setAuth({ error: null, isLoading: false });
      view.rerender(gate());
      expect(screen.getByRole("button", { name: "다시 시도 중..." })).toBeDisabled();
      expectHidden();
      expectNoRedirect();
      setAuth({ isLoading: true });
      view.rerender(gate());
      expectHidden();
      expectNoRedirect();

      // refetch handles API failures in AuthProvider and resolves with error state.
      await act(async () => {
        setAuth({
          isLoading: false,
          error: outcome === "failed" ? new Error("retry failed") : null,
          user: outcome === "authenticated" ? user : outcome === "onboarding" ? { ...user, onboarded: false } : null,
          isOnboarded: outcome === "authenticated",
          isAuthenticated: outcome === "authenticated" || outcome === "onboarding",
        });
        view.rerender(gate());
        pending.resolve();
        await pending.promise;
      });

      if (outcome === "authenticated") {
        expect(screen.getByText("보호된 콘텐츠")).toBeVisible();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expectNoRedirect();
      } else if (outcome === "failed") {
        expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled();
        expectHidden();
        expectNoRedirect();
        fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
        expect(mocks.refetch).toHaveBeenCalledTimes(2);
        await act(async () => { await pending.promise; });
      } else {
        expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(
          outcome === "anonymous"
            ? `/login?callbackUrl=${encodeURIComponent("/archive?id=a%2Fb&tab=notes")}`
            : `/signup?step=${FIRST_ONBOARDING_STEP}`,
        );
        expectHidden();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      }
    },
  );

  it.each(["loading", "error"] as const)("preserves an existing authenticated session during a background %s", (state) => {
    setAuth({ user, isAuthenticated: true, isOnboarded: true,
      isLoading: state === "loading", error: state === "error" ? new Error("background failure") : null });
    render(gate());
    expect(screen.getByText("보호된 콘텐츠")).toBeVisible();
    expectNoRedirect();
  });
});
