import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAnalysisViewed } from "./use-analysis-viewed";
const mocks = vi.hoisted(() => ({ capture: vi.fn(), epoch: 0 }));
vi.mock("./client", () => ({ capture: mocks.capture, getAnalyticsEpoch: () => mocks.epoch, isAnalyticsEpochCurrent: (epoch: number) => epoch === mocks.epoch }));
afterEach(cleanup);
beforeEach(() => { mocks.capture.mockClear(); mocks.epoch = 0; Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
it("observes foreground ready bodies once under StrictMode and keeps dwell separate", () => {
  const { rerender, result } = renderHook(({ ready }) => useAnalysisViewed({ analysisId: "a", analysisType: "individual", ready }), { initialProps: { ready: false }, wrapper: StrictMode });
  expect(mocks.capture).not.toHaveBeenCalled();
  rerender({ ready: true });
  expect(mocks.capture).toHaveBeenCalledTimes(1);
  expect(mocks.capture).toHaveBeenCalledWith("analysis_result_viewed", expect.objectContaining({ analysis_id: "a", schema_version: 2, source: "browser", view_id: expect.any(String), viewed_at: expect.any(String) }));
  expect(result.current?.view_id).toBeTruthy();
  rerender({ ready: true });
  expect(mocks.capture).toHaveBeenCalledTimes(1);
});
it("waits for foreground and isolates result route reuse", () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  const { rerender } = renderHook(({ id }) => useAnalysisViewed({ analysisId: id, analysisType: "keyword", ready: true }), { initialProps: { id: "a" } });
  expect(mocks.capture).not.toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  rerender({ id: "b" });
  expect(mocks.capture.mock.calls.filter(([name]) => name === "analysis_result_viewed").map(([, p]) => p.analysis_id)).toEqual(["a", "b"]);
});
it("does not attribute a hidden result to a later account", () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  renderHook(() => useAnalysisViewed({ analysisId: "a", analysisType: "keyword", ready: true }));
  mocks.epoch++;
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(mocks.capture).not.toHaveBeenCalled();
});
