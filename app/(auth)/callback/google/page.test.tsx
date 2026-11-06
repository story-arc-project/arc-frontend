import { StrictMode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn() },
  hardReplace: vi.fn(),
  post: vi.fn(),
  deleteAccount: vi.fn(),
  capture: vi.fn(),
  resetUser: vi.fn(),
  markSignup: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.params,
}));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, api: { ...actual.api, post: mocks.post } };
});
vi.mock("@/lib/api/auth-api", () => ({ deleteAccountWithSocial: mocks.deleteAccount }));
vi.mock("@/lib/analytics", () => ({
  capture: mocks.capture,
  resetUser: mocks.resetUser,
  markSignupCompletedIfUnseen: mocks.markSignup,
}));

import GoogleCallbackPage from "./page";
import { ApiError } from "@/lib/api/client";
import { readOAuthState } from "@/lib/auth/oauth-state";
import { FIRST_ONBOARDING_STEP } from "@/app/(auth)/constants";

function setup(query = "code=google-code&state=nonce", stored: string | null = "nonce") {
  mocks.params = new URLSearchParams(query);
  document.cookie = "oauth_state=; Max-Age=0; Path=/";
  if (stored !== null) document.cookie = `oauth_state=${stored}; Path=/`;
}
function expectNoRequests() {
  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.deleteAccount).not.toHaveBeenCalled();
  expect(mocks.hardReplace).not.toHaveBeenCalled();
  expect(mocks.router.push).not.toHaveBeenCalled();
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.resetUser).not.toHaveBeenCalled();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  document.cookie = "oauth_state=; Max-Age=0; Path=/";
  sessionStorage.clear();
  // jsdom navigation is replaced without contacting OAuth or deleting an account.
  vi.stubGlobal("location", { ...window.location, replace: mocks.hardReplace });
  mocks.post.mockResolvedValue({ data: { onboarded: true } });
  mocks.deleteAccount.mockResolvedValue(undefined);
  mocks.markSignup.mockResolvedValue(true);
  setup();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = "oauth_state=; Max-Age=0; Path=/";
  sessionStorage.clear();
});

describe("Google callback page", () => {
  it.each([
    ["cancelled", "error=access_denied&code=x&state=nonce", "nonce", "social_cancelled"],
    ["missing code", "state=nonce", "nonce", "social_cancelled"],
    ["missing returned state", "code=x", "nonce", "social_failed"],
    ["empty returned state", "code=x&state=", "nonce", "social_failed"],
    ["missing stored state", "code=x&state=nonce", null, "social_failed"],
    ["mismatched state", "code=x&state=other", "nonce", "social_failed"],
    ["stale deletion intent", "code=x&state=nonce", "delete:nonce", "social_failed"],
  ])("rejects %s before sending credentials", (_label, query, stored, error) => {
    setup(query, stored);
    render(<GoogleCallbackPage />);
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(`/login?error=${error}`);
    expect(readOAuthState()).toBeNull();
    expectNoRequests();
  });

  it("consumes state before the request resolves, shows loading, and hard replaces for an existing user", async () => {
    const pending = deferred<{ data: { onboarded: boolean } }>();
    mocks.post.mockImplementation(() => {
      expect(readOAuthState()).toBeNull();
      return pending.promise;
    });
    render(<GoogleCallbackPage />);
    expect(screen.getByText("로그인 처리 중...")).toBeVisible();
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith("/auth/social-login", { provider: "google", token: "google-code" }, { auth: false });
    expect(mocks.hardReplace).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ data: { onboarded: true } }));
    expect(mocks.hardReplace).toHaveBeenCalledExactlyOnceWith("/dashboard");
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(mocks.markSignup).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });

  it.each([true, false])("routes a new user without exposing email and respects the signup marker (%s)", async (unseen) => {
    mocks.post.mockResolvedValue({ data: { onboarded: false, user: { email: "new+user@example.test" } } });
    mocks.markSignup.mockResolvedValue(unseen);
    render(<GoogleCallbackPage />);
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledExactlyOnceWith(`/signup?step=${FIRST_ONBOARDING_STEP}`));
    expect(mocks.markSignup).toHaveBeenCalledExactlyOnceWith("new+user@example.test");
    if (unseen) expect(mocks.capture).toHaveBeenCalledExactlyOnceWith("signup_completed", { method: "google" });
    else expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.hardReplace).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(readOAuthState()).toBeNull();
  });

  it.each([
    [new ApiError(409, "conflict"), "already_exists"],
    [new ApiError(500, "server failure"), "social_failed"],
    [new Error("network failure"), "social_failed"],
  ])("routes login failure safely (%s)", async (error, message) => {
    mocks.post.mockRejectedValue(error);
    render(<GoogleCallbackPage />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(`/login?error=${message}`));
    expect(readOAuthState()).toBeNull();
    expect(mocks.hardReplace).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });

  it.each([
    ["cancelled", "error=access_denied&code=x&state=delete:nonce", "delete:nonce"],
    ["missing code", "state=delete:nonce", "delete:nonce"],
    ["missing stored state", "code=x&state=delete:nonce", null],
    ["mismatch", "code=x&state=delete:other", "delete:nonce"],
    ["normal stored state", "code=x&state=delete:nonce", "nonce"],
  ])("rejects deletion %s without falling through to login", (_label, query, stored) => {
    setup(query, stored);
    render(<GoogleCallbackPage />);
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith("/settings?deleteError=1");
    expect(readOAuthState()).toBeNull();
    expectNoRequests();
  });

  it.each([true, false])("keeps deletion isolated on API success=%s", async (success) => {
    setup("code=reauth-code&state=delete:nonce", "delete:nonce");
    const pending = deferred<void>();
    mocks.deleteAccount.mockImplementation(() => {
      expect(readOAuthState()).toBeNull();
      return pending.promise;
    });
    render(<GoogleCallbackPage />);
    expect(mocks.deleteAccount).toHaveBeenCalledExactlyOnceWith("reauth-code");
    expect(mocks.resetUser).not.toHaveBeenCalled();
    expect(mocks.hardReplace).not.toHaveBeenCalled();
    await act(async () => {
      if (success) pending.resolve();
      else pending.reject(new Error("reauth failed"));
    });
    if (success) {
      expect(mocks.resetUser).toHaveBeenCalledTimes(1);
      expect(mocks.hardReplace).toHaveBeenCalledExactlyOnceWith("/login?deleted=1");
      expect(mocks.resetUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.hardReplace.mock.invocationCallOrder[0]);
      expect(mocks.router.replace).not.toHaveBeenCalled();
    } else {
      expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith("/settings?deleteError=1");
      expect(mocks.resetUser).not.toHaveBeenCalled();
      expect(mocks.hardReplace).not.toHaveBeenCalled();
    }
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.markSignup).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it.each([false, true])("does not repeat a pending request under StrictMode or changed searchParams (delete=%s)", async (deleting) => {
    if (deleting) setup("code=google-code&state=delete:nonce", "delete:nonce");
    const pending = deferred<never>();
    mocks.post.mockReturnValue(pending.promise);
    mocks.deleteAccount.mockReturnValue(pending.promise);
    const view = render(<StrictMode><GoogleCallbackPage /></StrictMode>);
    mocks.params = new URLSearchParams(mocks.params);
    view.rerender(<StrictMode><GoogleCallbackPage /></StrictMode>);
    expect(deleting ? mocks.deleteAccount : mocks.post).toHaveBeenCalledTimes(1);
    expect(deleting ? mocks.post : mocks.deleteAccount).not.toHaveBeenCalled();
    expect(readOAuthState()).toBeNull();
    await act(async () => pending.reject(new Error("finished")));
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  });

  it("rejects a replay after unmount because the first mount consumed state", async () => {
    const first = render(<GoogleCallbackPage />);
    await waitFor(() => expect(mocks.hardReplace).toHaveBeenCalledTimes(1));
    first.unmount();
    mocks.router.replace.mockClear();
    render(<GoogleCallbackPage />);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith("/login?error=social_failed");
  });
});
