import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsufficientCreditsDialog } from "./InsufficientCreditsDialog";

import { FeedbackHost } from "@/components/features/feedback/FeedbackHost";
import { useFeedbackTriggers } from "@/contexts/FeedbackTriggerContext";
import { FEEDBACK_PROMPT_DELAY_MS } from "@/lib/feedback/campaigns";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { account: { email: "owner@example.com" } }, isLoading: false }) }));
vi.mock("@/components/features/credits/CreditBalance", () => ({ CreditBalance: () => <span>보유 잔액</span> }));

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
  it("keeps the source draft mounted while browsing missions and never sends a grant", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const onClose = vi.fn();
    const onCharge = vi.fn();
    const view = (open: boolean) => <><input aria-label="작성 중인 내용" defaultValue="보존할 작성 내용" /><InsufficientCreditsDialog open={open} onClose={onClose} onCharge={onCharge} /></>;
    const { rerender } = render(view(true));
    const source = screen.getByRole("textbox", { name: "작성 중인 내용" });
    await userEvent.click(screen.getByRole("button", { name: "미션 둘러보기" }));
    expect(await screen.findByText("미션 참여를 준비하고 있어요. 현재는 참여하거나 보상을 받을 수 없어요.")).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "작성 중인 내용" })).toBe(source);
    expect(source).toHaveValue("보존할 작성 내용");
    await userEvent.click(screen.getAllByRole("button", { name: "자세히 보기" })[0]);
    expect(screen.queryByRole("button", { name: "크레딧 받기" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "크레딧이 부족해요" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onCharge).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "미션 둘러보기" }));
    rerender(view(false));
    rerender(view(true));
    expect(screen.getByRole("dialog", { name: "크레딧이 부족해요" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "작성 중인 내용" })).toBe(source);
    await userEvent.click(screen.getByRole("button", { name: "충전 패키지 보기" }));
    expect(onCharge).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
  it("does not mount a dialog when closed", () => {
    render(<InsufficientCreditsDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
