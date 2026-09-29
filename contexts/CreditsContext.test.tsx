import { StrictMode, useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CreditsProvider from "./CreditsContext";
import { useCredits } from "@/hooks/useCredits";
import { getCredits } from "@/lib/api/credits-api";
import { invalidateCredits } from "@/lib/credits/events";
import { ApiError } from "@/lib/api/api-error";
vi.mock("@/lib/api/credits-api", () => ({ getCredits: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { account: { email: "a@test" } } as { account: { email: string } } | null, isLoading: false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const balance = { balance: 50, reserved: 3, available: 47, updated_at: "2026-09-30T00:00:00Z" };
function Consumer({ id = "state" }: { id?: string }) {
  const value = useCredits();
  return <button data-testid={id} onClick={() => void value.refetch()}>{JSON.stringify({ ...value, error: value.error?.message })}</button>;
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
const state = () => JSON.parse(screen.getByTestId("state").textContent!);
beforeEach(() => { vi.resetAllMocks(); auth.user = { account: { email: "a@test" } }; auth.isLoading = false; vi.mocked(getCredits).mockResolvedValue(balance); });
afterEach(cleanup);
it("is lazy without consumers and shares a request between two consumers", async () => {
  const view = render(<CreditsProvider><span /></CreditsProvider>);
  await act(async () => {});
  expect(getCredits).not.toHaveBeenCalled();
  view.rerender(<CreditsProvider><Consumer /><Consumer id="other" /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("success"));
  expect(getCredits).toHaveBeenCalledTimes(1);
});
it("clears synchronously on account switch and ignores old completion", async () => {
  const old = deferred<typeof balance>(); vi.mocked(getCredits).mockReturnValueOnce(old.promise);
  const view = render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(getCredits).mock.calls[0][0];
  auth.user = { account: { email: "b@test" } };
  vi.mocked(getCredits).mockResolvedValue({ ...balance, balance: 9, reserved: 0, available: 9 });
  view.rerender(<CreditsProvider><Consumer /></CreditsProvider>);
  expect(state().data).toBeNull();
  await waitFor(() => expect(state().data.available).toBe(9));
  await act(async () => old.resolve(balance));
  expect(signal?.aborted).toBe(true); expect(state().data.available).toBe(9);
});
it("never fetches or exposes data when auth is loading or absent", async () => {
  const view = render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("success"));
  auth.isLoading = true; view.rerender(<CreditsProvider><Consumer /></CreditsProvider>);
  expect(state().data).toBeNull();
  auth.isLoading = false; auth.user = null; view.rerender(<CreditsProvider><Consumer /></CreditsProvider>);
  await act(async () => {}); expect(state().status).toBe("idle"); expect(getCredits).toHaveBeenCalledTimes(1);
});
it("retains same-account snapshot as stale after failed refresh", async () => {
  render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("success"));
  vi.mocked(getCredits).mockRejectedValue(new Error("offline"));
  act(() => invalidateCredits());
  await waitFor(() => expect(state().status).toBe("error"));
  expect(state().data).toEqual(balance); expect(state().isStale).toBe(true);
});
it("queues one follow-up for invalidation during a request", async () => {
  const first = deferred<typeof balance>(); vi.mocked(getCredits).mockReturnValueOnce(first.promise);
  render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(1));
  act(() => { invalidateCredits(); invalidateCredits(); });
  expect(getCredits).toHaveBeenCalledTimes(1);
  await act(async () => first.resolve(balance));
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(2));
  expect(state().isStale).toBe(false);
});
it.each([404, 501])("represents %i as unavailable without fake zero", async status => {
  vi.mocked(getCredits).mockRejectedValue(new ApiError(status, "missing"));
  render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("unavailable")); expect(state().data).toBeNull();
});
it("refreshes on visible return and online with concurrent events deduplicated", async () => {
  render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("success"));
  await act(async () => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("online")); });
  expect(getCredits).toHaveBeenCalledTimes(2);
});
it("survives StrictMode and aborts/cleans listeners on last unmount", async () => {
  const pending = deferred<typeof balance>(); vi.mocked(getCredits).mockReturnValue(pending.promise);
  const view = render(<StrictMode><CreditsProvider><Consumer /></CreditsProvider></StrictMode>);
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(getCredits).mock.calls[0][0];
  view.unmount(); await act(async () => {}); expect(signal?.aborted).toBe(true);
  act(() => invalidateCredits()); expect(getCredits).toHaveBeenCalledTimes(1);
});
it("represents a genuine zero as success and an initial network error without data", async () => {
  vi.mocked(getCredits).mockResolvedValueOnce({ ...balance, balance: 0, reserved: 0, available: 0 });
  const view = render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("success")); expect(state().data.available).toBe(0);
  auth.user = { account: { email: "b@test" } };
  vi.mocked(getCredits).mockRejectedValue(new Error("network"));
  view.rerender(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("error")); expect(state().data).toBeNull();
});
it("hides old data during auth loading without remounting children, then requests afresh", async () => {
  const mount = vi.fn();
  function Form() { const [text, setText] = useState(() => { mount(); return "draft"; }); return <input aria-label="draft" value={text} onChange={e => setText(e.target.value)} />; }
  const view = render(<CreditsProvider><Consumer /><Form /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("success"));
  auth.isLoading = true; view.rerender(<CreditsProvider><Consumer /><Form /></CreditsProvider>);
  expect(state().data).toBeNull();
  auth.isLoading = false; view.rerender(<CreditsProvider><Consumer /><Form /></CreditsProvider>);
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(2));
  expect(mount).toHaveBeenCalledTimes(1);
});
it("discards an abandoned request and fetches on consumer return", async () => {
  const first = deferred<typeof balance>(); vi.mocked(getCredits).mockReturnValueOnce(first.promise);
  const view = render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(1));
  view.rerender(<CreditsProvider><span /></CreditsProvider>);
  await act(async () => {});
  view.rerender(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(2));
  await act(async () => first.resolve({ ...balance, balance: 100, available: 97 }));
  expect(state().data).toEqual(balance);
});
it("ignores focus while hidden", async () => {
  render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("success"));
  const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(getCredits).toHaveBeenCalledTimes(1); spy.mockRestore();
});
it("queues a fresh read when reconnecting behind a failing in-flight request", async () => {
  const first = deferred<typeof balance>(); vi.mocked(getCredits).mockReturnValueOnce(first.promise);
  render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(1));
  act(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online")); });
  await act(async () => first.reject(new Error("offline")));
  await waitFor(() => expect(getCredits).toHaveBeenCalledTimes(2));
  expect(state().status).toBe("success");
});
it("keeps cached data retry status coherent after a failed refresh", async () => {
  render(<CreditsProvider><Consumer /></CreditsProvider>);
  await waitFor(() => expect(state().status).toBe("success"));
  vi.mocked(getCredits).mockRejectedValueOnce(new Error("offline"));
  act(() => invalidateCredits());
  await waitFor(() => expect(state().status).toBe("error"));
  const retry = deferred<typeof balance>(); vi.mocked(getCredits).mockReturnValueOnce(retry.promise);
  await act(async () => screen.getByTestId("state").click());
  expect(state()).toMatchObject({ status: "success", data: balance, isRefreshing: true, isStale: true });
  expect(state().error).toBeUndefined();
  await act(async () => retry.resolve(balance));
  expect(state().isStale).toBe(false);
});
