import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({ email: "a@example.com", create: vi.fn(), push: vi.fn(), capture: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { account: { email: mocks.email } }, isLoading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }));
vi.mock("@/lib/api/cover-letter-api", () => ({ createCoverLetter: mocks.create }));
vi.mock("@/lib/analytics", () => ({ capture: mocks.capture }));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));
vi.mock("@/contexts/FeedbackTriggerContext", () => ({ useSuppressFeedback: vi.fn() }));
import Page from "./page";
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.email = "a@example.com"; });
describe("cover letter request identity", () => {
  it("reuses the payload key after losing a response", async () => {
    mocks.create.mockRejectedValue(new TypeError("lost"));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "초안 만들기" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.create.mock.calls[1][1].idempotencyKey).toBe(mocks.create.mock.calls[0][1].idempotencyKey);
    expect(mocks.create.mock.calls[1][0]).toEqual(mocks.create.mock.calls[0][0]);
  });
  it("does not navigate or record acceptance for a previous account response", async () => {
    let resolve!: (value: { id: string }) => void;
    mocks.create.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const user = userEvent.setup();
    const { rerender } = render(<Page />);
    await user.click(screen.getByRole("button", { name: "초안 만들기" }));
    mocks.email = "b@example.com";
    rerender(<Page />);
    resolve({ id: "old-account-result" });
    await Promise.resolve();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalledWith("export_completed", expect.anything());
  });
});
