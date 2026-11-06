import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Fail closed: even an accidental submit can never reach a real account API/OAuth.
vi.mock("@/lib/api/auth-api", () => ({ deleteAccountWithPassword: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ resetUser: vi.fn() }));
vi.mock("@/lib/auth/oauth-providers", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/oauth-providers")>(),
  startOAuthReauth: vi.fn(() => false),
}));

import { deleteAccountWithPassword } from "@/lib/api/auth-api";
import { startOAuthReauth } from "@/lib/auth/oauth-providers";
import { DeleteAccountCard } from "./DeleteAccountCard";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

describe("DeleteAccountCard (FRT-245)", () => {
  it("shows OAuth failure once and removes only deleteError from the URL", () => {
    window.history.replaceState(null, "", "/settings?deleteError=1&tab=security");
    const view = render(<DeleteAccountCard isSocialAccount connectedOauth={["google"]} />);
    expect(screen.getByText("탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeVisible();
    expect(window.location.pathname + window.location.search).toBe("/settings?tab=security");
    view.unmount();
    render(<DeleteAccountCard isSocialAccount connectedOauth={["google"]} />);
    expect(screen.queryByText("탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeNull();
  });

  it("cleans the URL without leaving a query delimiter when deleteError is the only parameter", () => {
    window.history.replaceState(null, "", "/settings?deleteError=1");
    render(<DeleteAccountCard isSocialAccount connectedOauth={["google"]} />);
    expect(screen.getByText("탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeVisible();
    expect(window.location.href).toMatch(/\/settings$/);
  });

  it("does not treat other deleteError values as a failed reauthentication", () => {
    window.history.replaceState(null, "", "/settings?deleteError=0&tab=security");
    render(<DeleteAccountCard isSocialAccount={false} connectedOauth={[]} />);
    expect(screen.queryByText("탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeNull();
    expect(window.location.search).toBe("?deleteError=0&tab=security");
  });

  it("opens confirmation, cancels without deletion, and clears password on reopening", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountCard isSocialAccount={false} connectedOauth={[]} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "회원 탈퇴" }));
    expect(screen.getByRole("dialog", { name: "회원 탈퇴 확인" })).toBeVisible();
    await user.type(screen.getByLabelText("현재 비밀번호"), "never-send");
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "회원 탈퇴" }));
    expect(screen.getByLabelText("현재 비밀번호")).toHaveValue("");
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeDisabled();
    expect(deleteAccountWithPassword).not.toHaveBeenCalled();
    expect(startOAuthReauth).not.toHaveBeenCalled();
  });
});
