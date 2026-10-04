import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsufficientCreditsDialog } from "./InsufficientCreditsDialog";

import { FeedbackHost } from "@/components/features/feedback/FeedbackHost";
import { useFeedbackTriggers } from "@/contexts/FeedbackTriggerContext";
import { FEEDBACK_PROMPT_DELAY_MS } from "@/lib/feedback/campaigns";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
const feedbackApi = vi.hoisted(() => ({ markFeedbackPromptShown: vi.fn() }));
vi.mock("@/lib/api/feedback-api", () => feedbackApi);

function ReportExperience() {
  const triggers = useFeedbackTriggers();
  return <button onClick={() => triggers?.reportExperienceCount(3)}>Report experience</button>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("InsufficientCreditsDialog", () => {
  it("defers global feedback until the credit dialog closes", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "true");
    feedbackApi.markFeedbackPromptShown.mockResolvedValue({ created: true });
    const onClose = vi.fn();
    const view = (open: boolean) => (
      <FeedbackHost>
        <ReportExperience />
        <InsufficientCreditsDialog open={open} onClose={onClose} />
      </FeedbackHost>
    );
    const { rerender } = render(view(true));
    fireEvent.click(screen.getByRole("button", { name: "Report experience" }));
    await act(async () => { vi.advanceTimersByTime(FEEDBACK_PROMPT_DELAY_MS * 5); });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "크레딧이 부족해요" })).toBeInTheDocument();
    expect(feedbackApi.markFeedbackPromptShown).not.toHaveBeenCalled();

    rerender(view(false));
    await act(async () => { vi.advanceTimersByTime(FEEDBACK_PROMPT_DELAY_MS); });
    expect(screen.queryByRole("dialog", { name: "크레딧이 부족해요" })).toBeNull();
    expect(screen.getByRole("heading", { name: "ARC에 기록해 보니 어떠셨나요?" })).toBeInTheDocument();
    expect(feedbackApi.markFeedbackPromptShown).toHaveBeenCalledTimes(1);
  });
  it("offers a real charge link and supports Escape dismissal", async () => {
    const onClose = vi.fn();
    render(<InsufficientCreditsDialog open onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "크레딧이 부족해요" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("link", { name: "충전 페이지로 이동" })).toHaveAttribute("href", "/credits/charge");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("does not mount a dialog when closed", () => {
    render(<InsufficientCreditsDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
