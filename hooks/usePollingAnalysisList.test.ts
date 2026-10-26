import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisSnapshot } from "@/types/analysis";
vi.mock("@/lib/api/analysis-api", () => ({ getComprehensiveList: vi.fn(), getKeywordList: vi.fn(), deleteComprehensiveAnalysis: vi.fn(), deleteKeywordAnalysis: vi.fn() }));
const replace = vi.fn();
let started: string | null = null;
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams(started ? { started } : {}) }));
const rearm = vi.fn();
let watch: Parameters<typeof import("@/lib/analysis/use-analysis-progress-watch").useAnalysisProgressWatch>[0];
vi.mock("@/lib/analysis/use-analysis-progress-watch", () => ({ isAnalysisInFlight: (status: string) => ["pending", "processing"].includes(status), useAnalysisProgressWatch: (options: typeof watch) => { watch = options; return { rearm }; } }));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));
import { getComprehensiveList, getKeywordList, deleteComprehensiveAnalysis, deleteKeywordAnalysis } from "@/lib/api/analysis-api";
import { toast } from "@/components/ui/toast";
import { usePollingAnalysisList } from "./usePollingAnalysisList";
const item = { id: "a", status: "failed", title: "A" } as AnalysisSnapshot;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); started = null; vi.mocked(getComprehensiveList).mockResolvedValue([item]); vi.mocked(getKeywordList).mockResolvedValue([item]); });
describe.each(["comprehensive", "keyword"] as const)("%s polling list", (type) => {
  const get = type === "keyword" ? vi.mocked(getKeywordList) : vi.mocked(getComprehensiveList);
  const remove = type === "keyword" ? vi.mocked(deleteKeywordAnalysis) : vi.mocked(deleteComprehensiveAnalysis);
  it("loads the domain and pauses foreground requests, recovers errors and keeps background errors quiet", async () => {
    get.mockRejectedValueOnce(new Error());
    const { result } = renderHook(() => usePollingAnalysisList(type));
    expect(result.current.loading).toBe(true); expect(watch.paused).toBe(true);
    await waitFor(() => expect(result.current.error).toBe(true));
    await act(async () => { await result.current.loadData(); });
    expect(result.current.items).toEqual([item]); expect(result.current.error).toBe(false); expect(watch.type).toBe(type);
    get.mockRejectedValueOnce(new Error());
    await act(async () => { expect(await watch.refresh()).toBe(true); });
    expect(result.current.error).toBe(false); expect(result.current.items).toEqual([item]);
    act(() => { watch.onCompleted?.([item, item]); });
    expect(toast).toHaveBeenCalledWith("분석 2건이 완료됐어요.", "success");
    act(() => { watch.onCompleted?.([item]); });
    expect(toast).toHaveBeenCalledWith("분석이 완료됐어요.", "success");
  });
  it.each(["bookmark", "retry", "delete", "foreground"])("rejects background responses after %s", async (mutation) => {
    const { result } = renderHook(() => usePollingAnalysisList(type));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const pending = deferred<AnalysisSnapshot[]>(); get.mockReturnValueOnce(pending.promise);
    let refresh!: ReturnType<typeof watch.refresh>;
    act(() => { refresh = watch.refresh(); });
    await act(async () => {
      if (mutation === "bookmark") result.current.handleBookmarked("a", true);
      if (mutation === "retry") result.current.handleRetried("a");
      if (mutation === "foreground") await result.current.loadData();
    });
    if (mutation === "delete") { act(() => result.current.requestDelete("a")); await act(async () => { await result.current.handleDelete(); }); }
    await act(async () => { pending.resolve([]); expect(await refresh).toBe(false); });
    if (mutation !== "delete") expect(result.current.items).toHaveLength(1);
    if (mutation === "bookmark") expect(result.current.items[0].isBookmarked).toBe(true);
    if (mutation === "retry") { expect(result.current.items[0].status).toBe("processing"); expect(rearm).toHaveBeenCalledOnce(); expect(replace).toHaveBeenCalledWith(`/analysis/${type}?started=a`, { scroll: false }); }
  });
  it("retains started while processing and clears it when settled or deleted; preserves failed deletion until cancel", async () => {
    started = "a"; get.mockResolvedValueOnce([{ ...item, status: "processing" }]);
    const { result } = renderHook(() => usePollingAnalysisList(type));
    await waitFor(() => expect(result.current.loading).toBe(false)); expect(replace).not.toHaveBeenCalled();
    act(() => result.current.requestDelete("a")); remove.mockRejectedValueOnce(new Error());
    await act(async () => { await result.current.handleDelete(); });
    expect(result.current.deleteError).toBe(true); expect(result.current.deleteId).toBe("a");
    act(() => result.current.cancelDelete()); expect(result.current.deleteError).toBe(false); expect(result.current.deleteId).toBeNull();
    act(() => result.current.requestDelete("a")); await act(async () => { await result.current.handleDelete(); });
    expect(remove).toHaveBeenCalledWith("a"); expect(replace).toHaveBeenCalledWith(`/analysis/${type}`, { scroll: false }); expect(result.current.items).toEqual([]);
    replace.mockClear(); await act(async () => { await result.current.loadData(); });
    expect(replace).toHaveBeenCalledWith(`/analysis/${type}`, { scroll: false });
  });
});
