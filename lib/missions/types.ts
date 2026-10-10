/** Frontend port only; BAC-77/78/79 HTTP contract is not inferred from these types. */
export const MISSION_IDS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"] as const;
export type MissionId = typeof MISSION_IDS[number];
export type MissionStatus = "available" | "reviewing" | "needs_revision" | "claimable" | "claimed" | "closed" | "unavailable";
export interface MissionDefinition {
  id: MissionId;
  title: string;
  description: string;
  reward: number;
  limit: string;
  verification: string;
  retroactive: boolean;
  kind: "evidence" | "external" | "invite" | "automatic";
}
export interface MissionDraft { url: string; note: string }
export interface MissionProgress {
  missionId: MissionId;
  status: MissionStatus;
  cycleId?: string;
  rewardId?: string;
  reason?: string;
  actionUrl?: string;
  submission?: MissionDraft;
  invitation?: { url: string; qualifiedCount: number; pendingCount: number };
}
export interface MissionSnapshot { version: string; missions: MissionProgress[] }
export interface MissionSubmission extends MissionDraft { missionId: MissionId; cycleId: string; requestId: string }
export interface MissionClaim { missionId: MissionId; rewardId: string; requestId: string }
export interface MissionAdapter {
  load: (signal: AbortSignal) => Promise<MissionSnapshot>;
  submit: (input: MissionSubmission, signal: AbortSignal) => Promise<void>;
  claim: (input: MissionClaim, signal: AbortSignal) => Promise<void>;
}
export interface MissionMutation { operation?: "submit" | "claim"; status: "idle" | "pending" | "uncertain" | "success" | "error"; message?: string }
export interface MissionState {
  status: "idle" | "loading" | "success" | "error" | "unavailable";
  snapshot: MissionSnapshot | null;
  refreshing: boolean;
  drafts: Partial<Record<MissionId, MissionDraft>>;
  mutations: Partial<Record<MissionId, MissionMutation>>;
}
