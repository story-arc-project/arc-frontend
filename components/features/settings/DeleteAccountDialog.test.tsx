import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api/auth-api", () => ({ deleteAccountWithPassword: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ resetUser: vi.fn() }));
vi.mock("@/lib/auth/oauth-providers", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/oauth-providers")>(),
  startOAuthReauth: vi.fn(),
}));

import { ApiError } from "@/lib/api/client";
import { deleteAccountWithPassword } from "@/lib/api/auth-api";
import { resetUser } from "@/lib/analytics";
import { startOAuthReauth } from "@/lib/auth/oauth-providers";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

const deleteMock = vi.mocked(deleteAccountWithPassword);
const oauthMock = vi.mocked(startOAuthReauth);

beforeEach(() => {
  vi.clearAllMocks();
  // Rejections are intentional: success navigation is covered by the existing mock E2E.
  deleteMock.mockReset().mockRejectedValue(new Error("mock failure"));
  oauthMock.mockReset().mockReturnValue(false);
});
afterEach(cleanup);

function mount(isSocialAccount = false, connectedOauth: string[] = []) {
  const onClose = vi.fn();
  render(<DeleteAccountDialog open onClose={onClose} isSocialAccount={isSocialAccount} connectedOauth={connectedOauth} />);
  return onClose;
}

function ReopenableDialog() {
  const [open, setOpen] = useState(true);
  return <>
    <button onClick={() => setOpen(true)}>다시 열기</button>
    <DeleteAccountDialog open={open} onClose={() => setOpen(false)} isSocialAccount={false} connectedOauth={[]} />
  </>;
}

describe("DeleteAccountDialog (FRT-245)", () => {
  it("requires an explicit nonempty password confirmation before requesting deletion", async () => {
    const user = userEvent.setup();
    mount();
    const submit = screen.getByRole("button", { name: "탈퇴하기" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    await user.type(screen.getByLabelText("현재 비밀번호"), "test-password");
    expect(submit).toBeEnabled();
    await user.keyboard("{Enter}");
    expect(deleteMock).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("현재 비밀번호"));
    expect(submit).toBeDisabled();
  });

  it.each([
    [401, "비밀번호가 올바르지 않아요."],
    [500, "탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요."],
  ])("handles API %i without resetting identity and permits a deliberate retry", async (status, message) => {
    const user = userEvent.setup();
    deleteMock.mockRejectedValue(new ApiError(status, "mock error"));
    const onClose = mount();
    await user.type(screen.getByLabelText("현재 비밀번호"), "first-password");
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    expect(await screen.findByText(message)).toBeVisible();
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith("first-password");
    expect(resetUser).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "취소" })).toBeEnabled();
    await user.clear(screen.getByLabelText("현재 비밀번호"));
    await user.type(screen.getByLabelText("현재 비밀번호"), "retry-password");
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    expect(deleteMock).toHaveBeenNthCalledWith(2, "retry-password");
    expect(oauthMock).not.toHaveBeenCalled();
  });

  it("blocks repeated clicks and all close paths while a password request is pending", async () => {
    const user = userEvent.setup();
    let reject!: (reason: Error) => void;
    deleteMock.mockReturnValue(new Promise<void>((_, rejectPromise) => { reject = rejectPromise; }));
    const onClose = mount();
    await user.type(screen.getByLabelText("현재 비밀번호"), "pending-password");
    await user.dblClick(screen.getByRole("button", { name: "탈퇴하기" }));
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith("pending-password");
    expect(screen.getByRole("button", { name: "탈퇴 처리 중..." })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "취소" }));
    await user.keyboard("{Escape}");
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => reject(new Error("mock failure")));
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeEnabled();
    expect(screen.getByText("탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeVisible();
    expect(resetUser).not.toHaveBeenCalled();
  });

  it.each(["cancel", "escape", "backdrop"])("clears failed attempt and password when closed by %s", async (path) => {
    const user = userEvent.setup();
    render(<ReopenableDialog />);
    await user.type(screen.getByLabelText("현재 비밀번호"), "old-password");
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    expect(await screen.findByText("탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeVisible();
    if (path === "cancel") await user.click(screen.getByRole("button", { name: "취소" }));
    if (path === "escape") await user.keyboard("{Escape}");
    if (path === "backdrop") fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "다시 열기" }));
    expect(screen.getByLabelText("현재 비밀번호")).toHaveValue("");
    expect(screen.queryByText("탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.")).toBeNull();
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeDisabled();
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it.each([{ providers: [] }, { providers: ["kakao"] }])("rejects unsupported social providers $providers without starting OAuth or deletion", async ({ providers }) => {
    const user = userEvent.setup();
    mount(true, providers);
    expect(screen.queryByLabelText("현재 비밀번호")).toBeNull();
    await user.click(screen.getByRole("button", { name: "소셜 인증하고 탈퇴하기" }));
    expect(screen.getByText("지원하지 않는 로그인 방식이에요.")).toBeVisible();
    expect(oauthMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("shows unavailable Google reauthentication, then permits retry without password deletion", async () => {
    const user = userEvent.setup();
    mount(true, ["kakao", "google"]);
    await user.click(screen.getByRole("button", { name: "Google 인증하고 탈퇴하기" }));
    expect(screen.getByText("Google 인증을 사용할 수 없어요.")).toBeVisible();
    expect(oauthMock).toHaveBeenCalledExactlyOnceWith("google");
    expect(screen.getByRole("button", { name: "취소" })).toBeEnabled();
    oauthMock.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Google 인증하고 탈퇴하기" }));
    expect(screen.queryByText("Google 인증을 사용할 수 없어요.")).toBeNull();
    expect(screen.getByRole("button", { name: "이동 중..." })).toBeDisabled();
    expect(oauthMock).toHaveBeenCalledTimes(2);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("blocks repeated OAuth launches and closing after redirect starts", async () => {
    const user = userEvent.setup();
    oauthMock.mockReturnValue(true);
    const onClose = mount(true, ["google"]);
    await user.dblClick(screen.getByRole("button", { name: "Google 인증하고 탈퇴하기" }));
    await user.click(screen.getByRole("button", { name: "취소" }));
    await user.keyboard("{Escape}");
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(oauthMock).toHaveBeenCalledExactlyOnceWith("google");
    expect(onClose).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(resetUser).not.toHaveBeenCalled();
  });
});
