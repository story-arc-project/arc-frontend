import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false, isLoading: false }) }));
vi.mock("@/hooks/useRedirectIfAuthenticated", () => ({ useRedirectIfAuthenticated: () => ({ shouldRedirect: false }) }));
vi.mock("@/lib/analytics", () => ({ capture: vi.fn(), markSignupCompletedIfUnseen: vi.fn(), useFlowExit: () => ({ markCompleted: vi.fn() }) }));
vi.mock("@/lib/auth/signup-handoff", () => ({ clearSignupHandoff: vi.fn(), readSignupHandoff: vi.fn(), createSignupHandoff: vi.fn() }));
vi.mock("@/components/features/auth/SocialLoginButtons", () => ({ SocialLoginButtons: ({ onLogin }: { onLogin: () => void }) => <button onClick={onLogin}>Google test</button> }));
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: (_target, tag: string) => ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !["initial", "animate", "exit", "transition", "custom", "variants", "layout"].includes(key))), children) }),
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
}));

import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";
import { startOAuthReauth } from "./oauth-providers";
import { readOAuthState, clearOAuthState } from "./oauth-state";
import { capture } from "@/lib/analytics";
import { clearSignupHandoff } from "./signup-handoff";

const originalLocation = window.location;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client+&=test");
  Object.defineProperty(window, "location", { value: { origin: "https://app.test", protocol: "https:", href: "" }, writable: true, configurable: true });
  clearOAuthState();
});
afterEach(() => {
  cleanup();
  clearOAuthState();
  vi.unstubAllEnvs();
  Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
});

describe.each(["login", "signup", "delete"] as const)("%s Google OAuth contract", (flow) => {
  function start() {
    if (flow === "delete") return startOAuthReauth("google");
    render(flow === "login" ? <LoginPage /> : <SignupPage />);
    fireEvent.click(screen.getByRole("button", { name: "Google test" }));
  }

  it("preserves all authorize parameters and binds the real CSRF cookie to this attempt", () => {
    start();
    const url = new URL(window.location.href);
    const state = readOAuthState();
    expect(state).toMatch(flow === "delete" ? /^delete:[0-9a-f-]{36}$/ : /^[0-9a-f-]{36}$/);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: "client+&=test", redirect_uri: "https://app.test/callback/google", response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "select_account", state });
    if (flow === "signup") expect(capture).toHaveBeenCalledWith("signup_method_selected", { method: "google" });
    if (flow !== "delete") expect(clearSignupHandoff).toHaveBeenCalled();
    cleanup();
    start();
    expect(readOAuthState()).not.toBe(state);
  });

  it("does not navigate or create CSRF state when client ID is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    const result = start();
    expect(window.location.href).toBe("");
    expect(readOAuthState()).toBeNull();
    expect(capture).not.toHaveBeenCalledWith("signup_method_selected", { method: "google" });
    if (flow === "delete") expect(result).toBe(false);
    else expect(screen.getByText("Google 로그인을 사용할 수 없어요")).toBeTruthy();
  });
});
