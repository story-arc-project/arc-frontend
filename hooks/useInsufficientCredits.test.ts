import { useLayoutEffect } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import { useInsufficientCredits } from "./useInsufficientCredits";

const insufficient = new ApiError(402, "private server data");
describe("useInsufficientCredits", () => {
  it("does not open for normal/network failures and dismisses without another attempt", () => {
    const { result } = renderHook(() => useInsufficientCredits());
    const handle = result.current.beginAttempt();
    act(() => { expect(handle(new TypeError("offline"))).toBe(false); });
    expect(result.current.open).toBe(false);
    act(() => { expect(handle(insufficient)).toBe(true); });
    expect(result.current.open).toBe(true);
    act(() => result.current.onClose());
    expect(result.current.open).toBe(false);
  });
  it("ignores superseded, changed-scope and unmounted attempts", () => {
    const { result, rerender, unmount } = renderHook(({ scope }) => useInsufficientCredits(scope), { initialProps: { scope: "a" } });
    const old = result.current.beginAttempt();
    result.current.beginAttempt();
    act(() => { expect(old(insufficient)).toBe(true); });
    expect(result.current.open).toBe(false);
    const changed = result.current.beginAttempt();
    rerender({ scope: "b" });
    act(() => { expect(changed(insufficient)).toBe(true); });
    expect(result.current.open).toBe(false);
    const detached = result.current.beginAttempt();
    unmount();
    expect(detached(insufficient)).toBe(true);
  });
});

it("restores the initiating button even if the pending request blurred it", async () => {
  const button = document.createElement("button");
  document.body.append(button);
  button.focus();
  const { result, unmount } = renderHook(() => useInsufficientCredits());
  const handle = result.current.beginAttempt();
  button.blur();
  act(() => { handle(insufficient); });
  act(() => result.current.onClose());
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(document.activeElement).toBe(button);
  unmount();
  button.remove();
});

it("invalidates the previous scope before layout effects can settle its request", () => {
  let currentDuringCommit: boolean | undefined;
  const { result, rerender } = renderHook(({ scope }) => {
    const credits = useInsufficientCredits(scope);
    useLayoutEffect(() => {
      if (scope === "b") currentDuringCommit = previous?.isCurrent();
    }, [scope]);
    return credits;
  }, { initialProps: { scope: "a" } });
  const previous = result.current.beginAttempt();
  rerender({ scope: "b" });
  expect(currentDuringCommit).toBe(false);
});
