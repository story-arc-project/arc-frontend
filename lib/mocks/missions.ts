import type { MissionAdapter, MissionClaim, MissionId, MissionSnapshot, MissionSubmission } from "@/lib/missions/types";

export type MissionScenario = "normal" | "loading" | "load-error" | "empty" | "partial" | "no-rewards" | "claim-loss" | "submit-loss" | "balance-error";
const rewards: Record<MissionId, number> = { M1: 60, M2: 40, M3: 10, M4: 20, M5: 15, M6: 5, M7: 5, M8: 3, M9: 2, M10: 2 };
export function missionPreviewSnapshot(): MissionSnapshot {
  return { version: "preview-2026-10-10", missions: [
    { missionId: "M1", status: "available", cycleId: "preview-cycle", actionUrl: "https://example.com/interview" },
    { missionId: "M2", status: "needs_revision", cycleId: "preview-cycle", reason: "후기 주소가 비공개예요. 공개 설정을 확인해 주세요.", submission: { url: "https://example.com/my-arc-review", note: "아카이브에 저장한 경험으로 이력서를 작성한 과정을 정리했어요." } },
    { missionId: "M3", status: "available", cycleId: "preview-cycle", invitation: { url: "https://example.com/invite/preview", qualifiedCount: 2, pendingCount: 1 } },
    { missionId: "M4", status: "closed" },
    { missionId: "M5", status: "closed" },
    { missionId: "M6", status: "reviewing", cycleId: "preview-cycle", submission: { url: "https://example.com/share", note: "" } },
    { missionId: "M7", status: "claimable", rewardId: "preview-M7-1" },
    { missionId: "M8", status: "claimable", rewardId: "preview-M8-1" },
    { missionId: "M9", status: "claimed", rewardId: "preview-M9-1" },
    { missionId: "M10", status: "available", actionUrl: "/settings" },
  ] };
}

/** In-memory simulator only. Never imported by production routes or used as an API fallback. */
export function createMissionMock({ scenario = "normal", delayMs = 0 }: { scenario?: MissionScenario; delayMs?: number } = {}) {
  const snapshot = missionPreviewSnapshot();
  if (scenario === "empty") snapshot.missions = [];
  if (scenario === "partial") snapshot.missions = snapshot.missions.filter(m => m.missionId !== "M7");
  if (scenario === "no-rewards") snapshot.missions.forEach(m => { if (m.status === "claimable") m.status = "claimed"; });
  let balance = 12;
  let loadFailures = scenario === "load-error" ? 1 : 0;
  let claimFailures = scenario === "claim-loss" ? 1 : 0;
  let submitFailures = scenario === "submit-loss" ? 1 : 0;
  let balanceFailures = scenario === "balance-error" ? 1 : 0;
  const claims: MissionClaim[] = [];
  const submissions: MissionSubmission[] = [];
  const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, scenario === "loading" ? 2000 : delayMs);
    signal.addEventListener("abort", abort, { once: true });
  });
  const adapter: MissionAdapter = {
    async load(signal) {
      await wait(signal);
      if (loadFailures-- > 0) throw new Error("Preview load failed");
      return structuredClone(snapshot);
    },
    async submit(input, signal) {
      await wait(signal);
      const previous = submissions.find(s => s.requestId === input.requestId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(input)) throw new Error("Preview request conflict");
      if (!previous) {
        const progress = snapshot.missions.find(m => m.missionId === input.missionId);
        if (!progress || progress.cycleId !== input.cycleId || !["available", "needs_revision"].includes(progress.status)) throw new Error("Preview not submittable");
        progress.status = "reviewing";
        progress.submission = { url: input.url, note: input.note };
        delete progress.reason;
        submissions.push(structuredClone(input));
      }
      if (submitFailures-- > 0) throw new Error("Preview response lost after submit");
    },
    async claim(input, signal) {
      await wait(signal);
      const previous = claims.find(c => c.requestId === input.requestId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(input)) throw new Error("Preview request conflict");
      if (!previous) {
        const progress = snapshot.missions.find(m => m.missionId === input.missionId);
        if (!progress || progress.rewardId !== input.rewardId || progress.status !== "claimable") throw new Error("Preview not claimable");
        balance += rewards[input.missionId];
        progress.status = "claimed";
        claims.push(structuredClone(input));
      }
      if (claimFailures-- > 0) throw new Error("Preview response lost after claim");
    },
  };
  return {
    adapter, claims, submissions,
    async readBalance(signal: AbortSignal) {
      await wait(signal);
      if (claims.length && balanceFailures-- > 0) throw new Error("Preview balance refresh failed");
      return balance;
    },
    approve(id: MissionId) {
      const progress = snapshot.missions.find(m => m.missionId === id);
      if (progress && ["reviewing", "needs_revision"].includes(progress.status)) {
        progress.status = "claimable";
        progress.rewardId = `preview-${id}-1`;
      }
    },
  };
}
