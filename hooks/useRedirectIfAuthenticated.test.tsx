import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIRST_ONBOARDING_STEP } from "@/app/(auth)/constants";
import { useAuth } from "@/hooks/useAuth";
import { useRedirectIfAuthenticated } from "./useRedirectIfAuthenticated";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

let auth: ReturnType<typeof useAuth>;
const onboarding = `/signup?step=${FIRST_ONBOARDING_STEP}`;

beforeEach(() => {
  vi.clearAllMocks();
  auth = {
    isLoading: false,
    isAuthenticated: false,
    isOnboarded: false,
    error: null,
  } as ReturnType<typeof useAuth>;
  vi.mocked(useAuth).mockImplementation(() => auth);
});
afterEach(cleanup);

describe("useRedirectIfAuthenticated", () => {
  // Explicit expected outcomes keep this table independent of the guard expression.
  const cases = [
    { isAuthenticated: false, isOnboarded: false, allowed: [false, false, false, false] },
    { isAuthenticated: false, isOnboarded: true, allowed: [false, false, false, false] },
    { isAuthenticated: true, isOnboarded: false, allowed: [true, false, false, false] },
    { isAuthenticated: true, isOnboarded: true, allowed: [true, true, false, false] },
  ];
  const options = [
    { allowAuthenticated: false, allowOnboardingFlow: false },
    { allowAuthenticated: false, allowOnboardingFlow: true },
    { allowAuthenticated: true, allowOnboardingFlow: false },
    { allowAuthenticated: true, allowOnboardingFlow: true },
  ];

  for (const state of cases) {
    for (const [index, option] of options.entries()) {
      for (const isLoading of [false, true]) {
        it(`auth=${state.isAuthenticated}, onboarded=${state.isOnboarded}, loading=${isLoading}, options=${JSON.stringify(option)}`, () => {
          Object.assign(auth, state, { isLoading });
          const { result } = renderHook(() => useRedirectIfAuthenticated(option));
          const expected = isLoading ? false : state.allowed[index];
          expect(result.current).toEqual({ isLoading, shouldRedirect: expected, error: null });
          expect(replace.mock.calls).toEqual(expected ? [[state.isOnboarded ? "/dashboard" : onboarding]] : []);
        });
      }
    }
  }

  it("defaults to redirecting authenticated users after loading finishes", () => {
    Object.assign(auth, { isLoading: true, isAuthenticated: true });
    const { result, rerender } = renderHook(() => useRedirectIfAuthenticated());
    expect(result.current.shouldRedirect).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    auth.isLoading = false;
    rerender();
    expect(result.current.shouldRedirect).toBe(true);
    expect(replace.mock.calls).toEqual([[onboarding]]);
    // FRT-11: completing onboarding changes the destination even while redirect stays true.
    auth.isOnboarded = true;
    rerender();
    expect(replace.mock.calls).toEqual([[onboarding], ["/dashboard"]]);
    rerender();
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it("reacts to session acquisition and loss without navigating while signed out", () => {
    const { result, rerender } = renderHook(() => useRedirectIfAuthenticated({}));
    expect(replace).not.toHaveBeenCalled();
    Object.assign(auth, { isAuthenticated: true, isOnboarded: true });
    rerender();
    expect(result.current.shouldRedirect).toBe(true);
    expect(replace.mock.calls).toEqual([["/dashboard"]]);
    auth.isAuthenticated = false;
    rerender();
    expect(result.current.shouldRedirect).toBe(false);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("reacts to both option changes and onboarding completion", () => {
    auth.isAuthenticated = true;
    const { result, rerender } = renderHook(
      (options) => useRedirectIfAuthenticated(options),
      { initialProps: { allowOnboardingFlow: true, allowAuthenticated: false } },
    );
    expect(result.current.shouldRedirect).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    rerender({ allowOnboardingFlow: false, allowAuthenticated: false });
    expect(replace.mock.calls).toEqual([[onboarding]]);
    rerender({ allowOnboardingFlow: false, allowAuthenticated: true });
    expect(result.current.shouldRedirect).toBe(false);
    auth.isOnboarded = true;
    rerender({ allowOnboardingFlow: true, allowAuthenticated: false });
    expect(result.current.shouldRedirect).toBe(true);
    expect(replace.mock.calls).toEqual([[onboarding], ["/dashboard"]]);
  });

  it("returns errors without blocking a valid session redirect", () => {
    const error = new Error("logout failed");
    Object.assign(auth, { isAuthenticated: true, isOnboarded: true, error });
    const { result, rerender } = renderHook(() => useRedirectIfAuthenticated());
    expect(result.current.error).toBe(error);
    expect(replace.mock.calls).toEqual([["/dashboard"]]);
    // A failed auth lookup has no session and must not navigate.
    Object.assign(auth, { isAuthenticated: false, isOnboarded: false });
    rerender();
    expect(result.current).toEqual({ isLoading: false, shouldRedirect: false, error });
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
