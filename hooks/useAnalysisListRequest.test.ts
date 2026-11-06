import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAnalysisListRequest } from "./useAnalysisListRequest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const requests: ReturnType<typeof deferred<string[]>>[] = [];
  const loader = vi.fn(() => {
    const request = deferred<string[]>();
    requests.push(request);
    return request.promise;
  });
  const hook = renderHook(() => useAnalysisListRequest({ filter: "all", sort: "newest" }, [] as string[], loader));
  return { ...hook, loader, requests };
}

describe("useAnalysisListRequest", () => {
  it("treats equal selections as a no-op but refetches a batched away/back selection", async () => {
    const { result, requests, loader } = setup();
    await act(async () => requests[0].resolve(["original"]));
    act(() => result.current.setSelection({ filter: "all", sort: "newest" }));
    expect(loader).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    act(() => {
      result.current.setSelection((s) => ({ ...s, filter: "keyword" }));
      result.current.setSelection((s) => ({ ...s, filter: "all" }));
    });
    expect(result.current.loading).toBe(true);
    expect(loader).toHaveBeenCalledTimes(2);
    await act(async () => requests[1].resolve(["fresh"]));
    expect(result.current.result).toEqual(["fresh"]);
  });

  it("ignores stale success and failure across both selection axes", async () => {
    const { result, requests, loader } = setup();
    act(() => result.current.setSelection((s) => ({ ...s, filter: "individual" })));
    act(() => result.current.setSelection((s) => ({ ...s, sort: "oldest" })));
    expect(loader).toHaveBeenLastCalledWith({ filter: "individual", sort: "oldest" });
    await act(async () => requests[0].resolve(["stale"]));
    await act(async () => requests[1].reject(new Error("stale failure")));
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(false);
    await act(async () => requests[2].resolve(["current"]));
    expect(result.current.result).toEqual(["current"]);
    expect(result.current.loading).toBe(false);
  });

  it("retains results on failure, keeps the error during retry, and supports local mutations", async () => {
    const { result, requests } = setup();
    await act(async () => requests[0].resolve(["first"]));
    act(() => result.current.retry());
    await act(async () => requests[1].reject(new Error("failed")));
    expect(result.current.result).toEqual(["first"]);
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
    act(() => result.current.retry());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(true);
    await act(async () => requests[2].resolve(["recovered"]));
    expect(result.current.error).toBe(false);
    act(() => result.current.setResult((items) => [...items, "local"]));
    expect(result.current.result).toEqual(["recovered", "local"]);
  });

  it("does not reload when a render recreates the initial selection", () => {
    const { rerender, loader } = setup();
    rerender();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it.each(["resolve", "reject"] as const)("ignores cleaned-up StrictMode effect %s", async (settle) => {
    const old = deferred<string[]>();
    const current = deferred<string[]>();
    const loader = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result } = renderHook(
      () => useAnalysisListRequest({ filter: "all" }, [] as string[], loader),
      { reactStrictMode: true },
    );
    expect(loader).toHaveBeenCalledTimes(2);
    await act(async () => current.resolve(["current"]));
    await act(async () => {
      if (settle === "resolve") old.resolve(["stale"]);
      else old.reject(new Error("stale"));
    });
    expect(result.current.result).toEqual(["current"]);
    expect(result.current.error).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it.each(["resolve", "reject"] as const)("ignores %s after unmount", async (settle) => {
    const { result, requests, unmount } = setup();
    const before = result.current;
    unmount();
    await act(async () => {
      if (settle === "resolve") requests[0].resolve(["late"]);
      else requests[0].reject(new Error("late"));
    });
    await waitFor(() => expect(result.current).toBe(before));
  });
});
