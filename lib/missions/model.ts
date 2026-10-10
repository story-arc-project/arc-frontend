import { MISSIONS } from "./catalog";
import { MISSION_IDS, type MissionDraft, type MissionId, type MissionProgress, type MissionSnapshot, type MissionStatus } from "./types";
export { getMission } from "./catalog";
const statuses: MissionStatus[] = [
  "claimable",
  "available",
  "reviewing",
  "needs_revision",
  "claimed",
  "closed",
  "unavailable"
];
const internalPaths = new Set([
  "/settings",
  "/archive",
  "/archive/new",
  "/analysis",
  "/analysis/comprehensive/new",
  "/analysis/keyword/new"
]);
export function safeMissionUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\\u0000-\u001f]/.test(value))
    return;
  if (internalPaths.has(value))
    return value;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port || !host.includes(".") || host.endsWith(".") || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || /^[\d.]+$/.test(host) || host.includes(":"))
      return;
    return url.href;
  }
  catch {
    return;
  }
}
export function validateEvidence(draft: MissionDraft): {
  url?: string;
  note?: string;
} {
  const errors: {
    url?: string;
    note?: string;
  } = {};
  if (!safeMissionUrl(draft.url.trim())?.startsWith("https://"))
    errors.url = "누구나 확인할 수 있는 HTTPS 주소를 입력해 주세요.";
  if (draft.note.length > 2000)
    errors.note = "설명은 2,000자 이내로 입력해 주세요.";
  return errors;
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 2048;
export function normalizeSnapshot(input: unknown): MissionSnapshot {
  if (!record(input) || !string(input.version) || !Array.isArray(input.missions) || input.missions.length === 0)
    throw new Error("Invalid mission snapshot");
  const seen = new Set<MissionId>();
  const missions: MissionProgress[] = input.missions.map((row: unknown) => {
    if (!record(row) || !MISSION_IDS.includes(row.missionId as MissionId) || !statuses.includes(row.status as MissionStatus) || seen.has(row.missionId as MissionId))
      throw new Error("Invalid mission progress");
    const missionId = row.missionId as MissionId;
    const status = row.status as MissionStatus;
    seen.add(missionId);
    if (status === "claimable" && !string(row.rewardId))
      throw new Error("Missing reward identity");
    const result: MissionProgress = { missionId, status };
    for (const key of ["cycleId", "rewardId", "reason"] as const) {
      if (row[key] !== undefined) {
        if (!string(row[key]))
          throw new Error("Invalid mission field");
        result[key] = row[key];
      }
    }
    if (row.actionUrl !== undefined)
      result.actionUrl = safeMissionUrl(row.actionUrl);
    if (row.submission !== undefined) {
      const s = row.submission;
      if (!record(s) || typeof s.url !== "string" || typeof s.note !== "string" || Object.keys(validateEvidence({ url: s.url, note: s.note })).length)
        throw new Error("Invalid evidence");
      result.submission = { url: s.url, note: s.note };
    }
    if (row.invitation !== undefined) {
      const i = row.invitation;
      if (!record(i) || !safeMissionUrl(i.url)?.startsWith("https://") || !Number.isSafeInteger(i.qualifiedCount) || Number(i.qualifiedCount) < 0 || !Number.isSafeInteger(i.pendingCount) || Number(i.pendingCount) < 0)
        throw new Error("Invalid invitation");
      result.invitation = {
        url: safeMissionUrl(i.url)!, qualifiedCount: Number(i.qualifiedCount), pendingCount: Number(i.pendingCount)
      };
    }
    return result;
  });
  for (const id of MISSION_IDS)
    if (!seen.has(id))
      missions.push({ missionId: id, status: "unavailable" });
  return { version: input.version, missions };
}
export function getProgress(snapshot: MissionSnapshot | null, id: MissionId): MissionProgress {
  return snapshot?.missions.find(m => m.missionId === id) ?? { missionId: id, status: "unavailable" };
}
export function groupMissions(snapshot: MissionSnapshot | null) {
  const order = snapshot?.missions.map(p => p.missionId) ?? [];
  const definitions = [...order, ...MISSION_IDS.filter(id => !order.includes(id))].map(id => MISSIONS.find(m => m.id === id)!);
  return statuses.map(status => ({ status, missions: definitions.filter(m => getProgress(snapshot, m.id).status === status) }));
}
export function claimableTotal(snapshot: MissionSnapshot | null): number | null {
  if (!snapshot || MISSION_IDS.some(id => getProgress(snapshot, id).status === "unavailable")) {
    return null;
  }
  return snapshot.missions.reduce((sum, p) => sum + (p.status === "claimable" && p.rewardId ? MISSIONS.find(m => m.id === p.missionId)!.reward : 0), 0);
}
