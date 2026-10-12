import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MissionSession } from "./MissionSession";
import { MissionWorkspace } from "./MissionWorkspace";
import { MissionUnavailableError } from "@/lib/missions/store";
import type { MissionAdapter, MissionId, MissionProgress } from "@/lib/missions/types";

const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/funnel", () => ({ captureFunnel: capture, newFunnelId: () => "mission-flow", sanitizeFunnelEntry: (entry: string) => ["direct", "insufficient_credits"].includes(entry) ? entry : "unknown" }));
beforeEach(() => { capture.mockClear(); });
afterEach(cleanup);
function mount(progress: MissionProgress[], options: { enabled?: boolean; entry?: string; adapter?: Partial<MissionAdapter>; selected?: MissionId } = {}) {
  const adapter: MissionAdapter = { load: vi.fn().mockResolvedValue({ version: "1", missions: progress }), submit: vi.fn().mockResolvedValue(undefined), claim: vi.fn().mockResolvedValue(undefined), ...options.adapter };
  render(<StrictMode><MissionSession accountId="private@example.com" adapter={adapter} onClaimed={() => {}}><MissionWorkspace analyticsEnabled={options.enabled ?? true} entryPath={options.entry ?? "direct"} balance={null} onBack={() => {}} initialMissionId={options.selected} onNavigate={options.selected ? () => {} : undefined} /></MissionSession></StrictMode>);
  return adapter;
}
const events = (name: string) => capture.mock.calls.filter(([event]) => event === name);
it("records one unavailable result view under StrictMode, without starts or server successes", async () => {
  mount([], { adapter: { load: vi.fn().mockRejectedValue(new MissionUnavailableError()) } });
  await screen.findByText("미션 참여를 준비하고 있어요. 현재는 참여하거나 보상을 받을 수 없어요.");
  expect(capture.mock.calls).toEqual([["mission_page_viewed", { flow_id: "mission-flow", entry_path: "direct", availability: "unavailable" }]]);
});
it("keeps preview workspaces out of analytics even when capture is mocked", async () => {
  mount([{ missionId: "M2", status: "available", cycleId: "cycle" }], { enabled: false, selected: "M2" });
  const input = await screen.findByRole("textbox", { name: "공개 게시물 주소" });
  fireEvent.change(input, { target: { value: "https://private.example/review" } });
  fireEvent.click(screen.getByRole("button", { name: "검토 요청하기" }));
  expect(capture).not.toHaveBeenCalled();
});
it("starts evidence on first real input, validates before click event, and tags uncertain retries", async () => {
  const adapter = mount([{ missionId: "M2", status: "available", cycleId: "cycle-private" }], { selected: "M2", entry: "https://private.example/?email=private@example.com", adapter: { submit: vi.fn().mockRejectedValue(new Error("offline")) } });
  const input = await screen.findByRole("textbox", { name: "공개 게시물 주소" });
  expect(events("mission_started")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "검토 요청하기" }));
  expect(events("mission_submit_clicked")).toHaveLength(0);
  fireEvent.change(input, { target: { value: "https://private.example/review" } });
  fireEvent.change(screen.getByRole("textbox", { name: "함께 전할 내용 (선택)" }), { target: { value: "private evidence" } });
  expect(events("mission_started")).toEqual([["mission_started", { flow_id: "mission-flow", entry_path: "unknown", mission_id: "M2", participation_type: "evidence" }]]);
  fireEvent.click(screen.getByRole("button", { name: "검토 요청하기" }));
  fireEvent.click(await screen.findByRole("button", { name: "같은 요청으로 다시 확인" }));
  await waitFor(() => expect(adapter.submit).toHaveBeenCalledTimes(2));
  expect(events("mission_submit_clicked").map(([, props]) => props.is_retry)).toEqual([false, true]);
  expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private|cycle-private|https:/);
});
it("tags uncertain claims independently of opening a mission", async () => {
  mount([{ missionId: "M1", status: "claimable", rewardId: "reward-private" }], { selected: "M1", adapter: { claim: vi.fn().mockRejectedValue(new Error("offline")) } });
  fireEvent.click(await screen.findByRole("button", { name: "크레딧 받기" }));
  fireEvent.click(await screen.findByRole("button", { name: "수령 결과 다시 확인" }));
  expect(events("mission_claim_clicked").map(([, props]) => props.is_retry)).toEqual([false, true]);
  expect(events("mission_started")).toHaveLength(0);
});
it("starts external participation only on its outbound click", async () => {
  mount([{ missionId: "M1", status: "available", actionUrl: "https://example.com/interview" }], { selected: "M1" });
  const link = await screen.findByRole("link", { name: /참여 페이지 열기/ });
  expect(events("mission_started")).toHaveLength(0);
  fireEvent.click(link);
  fireEvent.click(link);
  expect(events("mission_started")).toHaveLength(1);
  expect(events("mission_started")[0][1].participation_type).toBe("external");
});
it("does not turn automatic retroactive activity into a mission start", async () => {
  mount([{ missionId: "M7", status: "available", actionUrl: "https://example.com/profile" }], { selected: "M7" });
  fireEvent.click(await screen.findByRole("link", { name: /설정·활동 확인하기/ }));
  expect(events("mission_started")).toHaveLength(0);
});
it("records invite sharing only after clipboard success without the invitation URL", async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  mount([{ missionId: "M3", status: "available", invitation: { url: "https://example.com/invite/private-code", qualifiedCount: 0, pendingCount: 0 } }], { selected: "M3" });
  const button = await screen.findByRole("button", { name: "초대 주소 복사" });
  fireEvent.click(button);
  await screen.findByText("복사하지 못했어요. 위 주소를 직접 복사해 주세요.");
  expect(events("mission_started")).toHaveLength(0);
  expect(events("referral_code_shared")).toHaveLength(0);
  fireEvent.click(button);
  await screen.findByText("초대 주소를 복사했어요.");
  expect(events("mission_started")).toHaveLength(1);
  expect(events("referral_code_shared")).toEqual([["referral_code_shared", { flow_id: "mission-flow", entry_path: "direct", mission_id: "M3", share_channel: "clipboard" }]]);
  expect(JSON.stringify(capture.mock.calls)).not.toContain("private-code");
});

it.each(["account", "detail"])("ignores clipboard completion after %s changes", async change => {
  let finish!: () => void;
  const writeText = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const adapter: MissionAdapter = { load: vi.fn().mockResolvedValue({ version: "1", missions: [
    { missionId: "M3", status: "available", invitation: { url: "https://example.com/invite", qualifiedCount: 0, pendingCount: 0 } },
    { missionId: "M1", status: "available", actionUrl: "https://example.com/interview" },
  ] }), submit: vi.fn(), claim: vi.fn() };
  const view = (account: string, selected: MissionId) => <StrictMode><MissionSession accountId={account} adapter={adapter} onClaimed={() => {}}><MissionWorkspace analyticsEnabled balance={null} onBack={() => {}} initialMissionId={selected} onNavigate={() => {}} /></MissionSession></StrictMode>;
  const { rerender } = render(view("account-a", "M3"));
  fireEvent.click(await screen.findByRole("button", { name: "초대 주소 복사" }));
  rerender(view(change === "account" ? "account-b" : "account-a", change === "detail" ? "M1" : "M3"));
  await act(async () => { finish(); });
  expect(events("referral_code_shared")).toHaveLength(0);
  expect(events("mission_started")).toHaveLength(0);
});
it("records a direct-detail initial result once across workspace remounts in one session", async () => {
  const adapter: MissionAdapter = { load: vi.fn().mockResolvedValue({ version: "1", missions: [{ missionId: "M1", status: "available", actionUrl: "https://example.com/interview" }] }), submit: vi.fn(), claim: vi.fn() };
  const view = (key: string, selected?: MissionId) => <StrictMode><MissionSession accountId="account-a" adapter={adapter} onClaimed={() => {}}><MissionWorkspace key={key} analyticsEnabled balance={null} onBack={() => {}} initialMissionId={selected} onNavigate={() => {}} /></MissionSession></StrictMode>;
  const { rerender } = render(view("detail", "M1"));
  await screen.findByRole("link", { name: /참여 페이지 열기/ });
  expect(events("mission_page_viewed")).toHaveLength(1);
  rerender(view("list"));
  expect(events("mission_page_viewed")).toHaveLength(1);
  rerender(view("detail-again", "M1"));
  expect(events("mission_page_viewed")).toHaveLength(1);
});
