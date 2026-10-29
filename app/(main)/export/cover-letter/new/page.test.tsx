import { ApiError } from "@/lib/api/api-error";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, cleanup, render, screen, waitFor } from "@testing-library/react";
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

describe("FRT-325 request outcomes", () => {
  it.each([
    ["success", null, true, "success"],
    ["malformed JSON", new ApiError(200, "private body"), true, "response_unreadable"],
    ["missing ID", new ApiError(201, "private ID"), true, "response_unreadable"],
    ["422", new ApiError(422, "private input"), false, "api_error"],
    ["credits", new ApiError(402, "private credits", "INSUFFICIENT_CREDITS"), false, "api_error"],
    ["5xx", new ApiError(503, "private server"), false, "api_error"],
    ["abort", new DOMException("private abort", "AbortError"), null, "aborted"],
    ["raw error", new TypeError("private network"), null, "network_or_unknown"],
  ] as const)("records %s once", async (_label, error, accepted, request_result) => {
    mocks.create.mockReset();
    if (error) mocks.create.mockRejectedValueOnce(error);
    else mocks.create.mockResolvedValueOnce({ id: "accepted-id" });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "초안 만들기" }));
    await waitFor(() => expect(mocks.capture.mock.calls.filter(([name]) => name === "export_requested")).toHaveLength(1));
    expect(mocks.capture).toHaveBeenCalledWith("export_requested", expect.objectContaining({ accepted, request_result }));
    expect(mocks.capture.mock.calls.filter(([name]) => name === "export_completed")).toHaveLength(0);
    expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain("private");
  });
});

describe("FRT-325 settlement lifecycle", () => {
  it.each(["resolve", "reject"] as const)("ignores %s after unmount", async (outcome) => {
    let resolve!: (value: { id: string }) => void;
    let reject!: (error: Error) => void;
    mocks.create.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    const view = render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "초안 만들기" }));
    view.unmount();
    await act(async () => {
      if (outcome === "resolve") resolve({ id: "old" });
      else reject(new Error("private stale error"));
    });
    expect(mocks.capture.mock.calls.filter(([name]) => name === "export_requested")).toHaveLength(0);
  });
  it("classifies its own timeout and clears the timer at API settlement", async () => {
    vi.useFakeTimers();
    try {
      mocks.create.mockImplementationOnce((_payload, options) => new Promise((_yes, no) => {
        options.signal.addEventListener("abort", () => no(new DOMException("timeout", "AbortError")));
      }));
      render(<Page />);
      fireEvent.click(screen.getByRole("button", { name: "초안 만들기" }));
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
      expect(mocks.capture).toHaveBeenCalledWith("export_requested", expect.objectContaining({ accepted: null, request_result: "timeout" }));
      expect(mocks.capture.mock.calls.filter(([name]) => name === "export_requested")).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
});

describe("FRT-325 account attribution", () => {
  it.each(["resolve", "reject"] as const)("ignores old-account %s", async (outcome) => {
    let resolve!: (value: { id: string }) => void;
    let reject!: (error: Error) => void;
    mocks.create.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    const view = render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "초안 만들기" }));
    mocks.email = "new@example.com";
    view.rerender(<Page />);
    await act(async () => {
      if (outcome === "resolve") resolve({ id: "old" });
      else reject(new Error("old account"));
    });
    expect(mocks.capture.mock.calls.filter(([name]) => name === "export_requested")).toHaveLength(0);
  });
});

it("keeps one accepted outcome when post-success UI throws", async () => {
  mocks.create.mockResolvedValueOnce({ id: "new" });
  mocks.push.mockImplementationOnce(() => { throw new Error("router"); });
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "초안 만들기" }));
  await waitFor(() => expect(mocks.capture.mock.calls.filter(([name]) => name === "export_requested")).toHaveLength(1));
  expect(mocks.capture).toHaveBeenCalledWith("export_requested", expect.objectContaining({ accepted: true, request_result: "success" }));
});

it("blocks duplicate clicks and reuses a response-loss retry key", async () => {
  let reject!: (error: Error) => void;
  mocks.create.mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; }));
  mocks.create.mockRejectedValueOnce(new TypeError("lost again"));
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "초안 만들기" }));
  const submit = screen.getByRole("button", { name: "초안 만들기" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(mocks.create).toHaveBeenCalledTimes(1);
  await act(async () => { reject(new TypeError("lost")); });
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
  expect(mocks.create.mock.calls[1][1].idempotencyKey).toBe(mocks.create.mock.calls[0][1].idempotencyKey);
  expect(mocks.create.mock.calls[1][0]).toEqual(mocks.create.mock.calls[0][0]);
  await waitFor(() => expect(mocks.capture.mock.calls.filter(([name]) => name === "export_requested")).toHaveLength(2));
});
