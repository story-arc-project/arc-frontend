import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFunnel } from "@/lib/analytics/funnel";
import CreditChargePage from "@/app/(main)/credits/charge/page";
import { CreditCharge } from "./CreditCharge";
import { DEFAULT_CREDIT_PACKAGES } from "@/lib/constants/credit-packages";

import { FeedbackHost } from "@/components/features/feedback/FeedbackHost";
import { useFeedbackTriggers } from "@/contexts/FeedbackTriggerContext";
import { FEEDBACK_PROMPT_DELAY_MS } from "@/lib/feedback/campaigns";

vi.mock("next/navigation", () => ({ usePathname: () => "/credits/charge" }));
const feedbackApi = vi.hoisted(() => ({ markFeedbackPromptShown: vi.fn() }));
vi.mock("@/lib/api/feedback-api", () => feedbackApi);

function ReportExperience() {
  const triggers = useFeedbackTriggers();
  return <button onClick={() => triggers?.reportExperienceCount(3)}>Report experience</button>;
}

vi.mock("@/lib/analytics/funnel", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/analytics/funnel")>(), captureFunnel: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("CreditCharge", () => {
  it("holds pending feedback while the payment preparation dialog is open", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "true");
    feedbackApi.markFeedbackPromptShown.mockResolvedValue({ created: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ packages: DEFAULT_CREDIT_PACKAGES }))));
    render(<FeedbackHost><ReportExperience /><CreditCharge /></FeedbackHost>);
    fireEvent.click(await screen.findByRole("radio", { name: /Lite/ }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Report experience" }));
    fireEvent.click(screen.getByRole("button", { name: "결제하기" }));
    await act(async () => { vi.advanceTimersByTime(FEEDBACK_PROMPT_DELAY_MS * 5); });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "크레딧 충전 안내" })).toBeInTheDocument();
    expect(feedbackApi.markFeedbackPromptShown).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    await act(async () => { vi.advanceTimersByTime(FEEDBACK_PROMPT_DELAY_MS); });
    expect(screen.queryByRole("dialog", { name: "크레딧 충전 안내" })).toBeNull();
    expect(screen.getByRole("heading", { name: "ARC에 기록해 보니 어떠셨나요?" })).toBeInTheDocument();
    expect(feedbackApi.markFeedbackPromptShown).toHaveBeenCalledTimes(1);
  });

  it("reveals availability only after explicit payment click and never sends a mutation", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ packages: DEFAULT_CREDIT_PACKAGES })));
    vi.stubGlobal("fetch", fetchSpy);
    render(<CreditCharge />);
    const pay = screen.getByRole("button", { name: "결제하기" });
    expect(pay).toBeDisabled();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(await screen.findByRole("radio", { name: /Lite/ }));
    expect(pay).toBeEnabled();
    expect(screen.queryByText("크레딧 충전을 준비하고 있어요")).toBeNull();
    fireEvent.click(pay);
    expect(screen.getByRole("dialog", { name: "크레딧 충전 안내" })).toBeInTheDocument();
    expect(screen.getByText(/결제는 진행되지 않았으며/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("radio", { name: /Lite/ })).toBeChecked();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "omit" });
  });

  it("keeps selection unavailable until the final catalog resolves", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    render(<CreditCharge />);
    expect(screen.getByRole("status")).toHaveTextContent("패키지를 불러오는 중이에요");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("button", { name: "결제하기" })).toBeDisabled();
    resolve(new Response(JSON.stringify({ packages: [{ id: "new", name: "New", credits: 30, price_krw: 6000 }] })));
    expect(await screen.findByRole("radio", { name: /New/ })).not.toBeChecked();
    expect(screen.queryByRole("radio", { name: /Lite/ })).toBeNull();
  });

  it("uses the shared default catalog for malformed responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ packages: [] }))));
    render(<CreditCharge />);
    expect(await screen.findByRole("radio", { name: /Lite/ })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "결제하기" })).toBeDisabled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});


describe("legacy credit funnel", () => {
  it("records committed API prices once in StrictMode and snapshots the selected offer without display names", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ packages: DEFAULT_CREDIT_PACKAGES }))));
    render(<StrictMode><CreditCharge /></StrictMode>);
    const radios = await screen.findAllByRole("radio");
    await waitFor(() => expect(vi.mocked(captureFunnel).mock.calls.filter(([event]) => event === "token_purchase_page_viewed")).toHaveLength(1));
    fireEvent.click(radios[0]);
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole("button", { name: "결제하기" }));
    const first = vi.mocked(captureFunnel).mock.calls.find(([event]) => event === "credit_purchase_intent")![1];
    expect(first).toMatchObject({ package_id: DEFAULT_CREDIT_PACKAGES[1].id, price_krw: DEFAULT_CREDIT_PACKAGES[1].price_krw, catalog_source: "api", offer_version: "unknown" });
    expect(vi.mocked(captureFunnel).mock.calls.filter(([event]) => event === "token_package_selected")[1][1]).toMatchObject({ deliberation_count: 2 });
    expect(vi.mocked(captureFunnel).mock.calls.find(([event]) => event === "fake_door_revealed")![1]).toMatchObject({ intent_id: (first as { intent_id: string }).intent_id });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "결제하기" }));
    const intents = vi.mocked(captureFunnel).mock.calls.filter(([event]) => event === "credit_purchase_intent");
    expect(intents).toHaveLength(2);
    expect(intents[1][1]).not.toMatchObject({ intent_id: (first as { intent_id: string }).intent_id });
    expect(JSON.stringify(vi.mocked(captureFunnel).mock.calls)).not.toContain('"name"');
  });
  it("preserves fallback UI but excludes failed catalog from verified price exposure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<CreditCharge />);
    fireEvent.click((await screen.findAllByRole("radio"))[0]);
    fireEvent.click(screen.getByRole("button", { name: "결제하기" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(vi.mocked(captureFunnel).mock.calls.some(([event]) => event === "token_purchase_page_viewed")).toBe(false);
    expect(vi.mocked(captureFunnel).mock.calls.find(([event]) => event === "credit_purchase_intent")![1]).toMatchObject({ catalog_source: "fallback" });
  });
});


it.each([
  ["insufficient_credits", "insufficient_credits"],
  [undefined, "charge_page"],
  ["private@example.com", "charge_page"],
  [["insufficient_credits"], "charge_page"],
])("accepts only the literal shortage entry from the route: %j", async (entry, expected) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ packages: DEFAULT_CREDIT_PACKAGES }))));
  render(await CreditChargePage({ searchParams: Promise.resolve({ entry }) }));
  const radios = await screen.findAllByRole("radio");
  await waitFor(() => expect(captureFunnel).toHaveBeenCalledWith("token_purchase_page_viewed", expect.objectContaining({ entry_path: expected })));
  fireEvent.click(radios[0]);
  fireEvent.click(screen.getByRole("button", { name: "결제하기" }));
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  const calls = vi.mocked(captureFunnel).mock.calls;
  expect(calls.map(([event]) => event)).toEqual(["token_purchase_page_viewed", "token_package_selected", "credit_purchase_intent", "fake_door_revealed", "fake_door_dismissed"]);
  for (const [, payload] of calls) expect(payload).toMatchObject({ entry_path: expected });
  expect(JSON.stringify(calls)).not.toContain("private@example.com");
});
