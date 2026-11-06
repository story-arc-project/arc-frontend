import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BookmarkToggle from "./BookmarkToggle";
const mocks = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn(), capture: vi.fn(), epoch: 0 }));
vi.mock("@/lib/api/analysis-api", () => ({ addBookmark: mocks.add, removeBookmark: mocks.remove }));
vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }));
vi.mock("@/lib/analytics/client", () => ({ capture: mocks.capture, getAnalyticsEpoch: () => mocks.epoch, isAnalyticsEpochCurrent: (epoch: number) => epoch === mocks.epoch }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.epoch = 0; });
it("waits for success, blocks duplicate clicks, and links the visible view", async () => {
  let finish!: () => void;
  mocks.add.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  render(<BookmarkToggle analysisId="a" isBookmarked={false} viewObservation={{ analysis_id: "a", analysis_type: "keyword", view_id: "view-a", viewed_at: "now", epoch: 0 }} />);
  fireEvent.click(screen.getByRole("button")); fireEvent.click(screen.getByRole("button"));
  expect(mocks.add).toHaveBeenCalledTimes(1); expect(mocks.capture).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(mocks.capture).toHaveBeenCalledWith("analysis_bookmark_changed", expect.objectContaining({ analysis_id: "a", view_id: "view-a", action: "added", is_bookmarked: true }));
});
it("observes removal from lists without inventing a view", async () => {
  mocks.remove.mockResolvedValue(undefined);
  render(<BookmarkToggle analysisId="a" isBookmarked />);
  await act(async () => fireEvent.click(screen.getByRole("button")));
  expect(mocks.capture).toHaveBeenCalledWith("analysis_bookmark_changed", { schema_version: 2, source: "browser", analysis_id: "a", action: "removed", is_bookmarked: false });
});
it("does not capture failures", async () => {
  mocks.add.mockRejectedValue(new Error("failed"));
  render(<BookmarkToggle analysisId="a" isBookmarked={false} />);
  await act(async () => fireEvent.click(screen.getByRole("button")));
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("ignores success after route reuse or account change", async () => {
  let finish!: () => void;
  mocks.add.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const onToggled = vi.fn();
  const { rerender } = render(<BookmarkToggle analysisId="a" isBookmarked={false} onToggled={onToggled} />);
  fireEvent.click(screen.getByRole("button"));
  mocks.epoch++;
  rerender(<BookmarkToggle analysisId="b" isBookmarked={false} onToggled={onToggled} />);
  await act(async () => finish());
  expect(mocks.capture).not.toHaveBeenCalled(); expect(onToggled).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "즐겨찾기" })).toBeEnabled();
});
