import { getMission } from "./catalog";
import { getProgress, normalizeSnapshot, validateEvidence } from "./model";
import type { MissionAdapter, MissionClaim, MissionDraft, MissionId, MissionState, MissionSubmission } from "./types";
export class MissionUnavailableError extends Error {
}
export class MissionRejectedError extends Error {
}
const initial = (): MissionState => ({
  status: "idle", snapshot: null, refreshing: false, drafts: {}, mutations: {}
});
type Attempt = {
  kind: "submit";
  input: MissionSubmission;
} | {
  kind: "claim";
  input: MissionClaim;
};
/** One instance per account owner. Transport failures retain immutable attempts. */
export class MissionStore {
  private state = initial();
  private listeners = new Set<() => void>();
  private controllers = new Set<AbortController>();
  private attempts = new Map<MissionId, Attempt>();
  private pending = new Set<MissionId>();
  private confirmedRewards = new Set<string>();
  private submittedCycles = new Map<MissionId, string>();
  private disposed = false;
  private revision = 0;
  private loadSequence = 0;
  private retainCount = 0;
  constructor(private adapter: MissionAdapter, private onClaimed: () => void | Promise<void> = () => {
  }) {
  }
  getSnapshot = (): MissionState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  retain = () => {
    this.retainCount++;
    return () => {
      this.retainCount--;
      queueMicrotask(() => {
        if (this.retainCount === 0)
          this.dispose();
      });
    };
  };
  private update(patch: Partial<MissionState>) {
    if (this.disposed)
      return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  }
  async load(): Promise<void> {
    if (this.disposed)
      return;
    const sequence = ++this.loadSequence;
    const revision = this.revision;
    const controller = new AbortController();
    this.controllers.add(controller);
    this.update({ status: this.state.snapshot ? this.state.status : "loading", refreshing: !!this.state.snapshot });
    try {
      const snapshot = normalizeSnapshot(await this.adapter.load(controller.signal));
      if (this.disposed || sequence !== this.loadSequence || revision !== this.revision || this.pending.size > 0)
        return;
      const drafts = { ...this.state.drafts };
      const mutations = { ...this.state.mutations };
      for (const p of snapshot.missions) {
        if (p.rewardId && this.confirmedRewards.has(p.rewardId))
          p.status = "claimed";
        if (p.status === "available" && p.cycleId && this.submittedCycles.get(p.missionId) === p.cycleId)
          p.status = "reviewing";
        if (p.status === "needs_revision")
          this.submittedCycles.delete(p.missionId);
        if (p.submission && !drafts[p.missionId])
          drafts[p.missionId] = { ...p.submission };
        const previous = getProgress(this.state.snapshot, p.missionId);
        if (mutations[p.missionId]?.operation === "claim" && mutations[p.missionId]?.status === "success" && p.rewardId && !this.confirmedRewards.has(p.rewardId)) {
          delete mutations[p.missionId];
        }
        if (!this.attempts.has(p.missionId) && !this.pending.has(p.missionId) &&
          (p.rewardId !== previous.rewardId || p.cycleId !== previous.cycleId || p.status === "needs_revision")) {
          delete mutations[p.missionId];
        }
      }
      this.update({
        status: "success", snapshot, refreshing: false, drafts, mutations
      });
    }
    catch (error) {
      if (!this.disposed && sequence === this.loadSequence && revision === this.revision)
        this.update({ status: error instanceof MissionUnavailableError ? "unavailable" : "error", refreshing: false });
    }
    finally {
      this.controllers.delete(controller);
      if (!this.disposed && sequence === this.loadSequence && this.state.refreshing) {
        this.update({ refreshing: false });
      }
    }
  }
  setDraft(id: MissionId, draft: MissionDraft): void {
    if (this.pending.has(id) || this.state.mutations[id]?.status === "uncertain")
      return;
    this.update({ drafts: { ...this.state.drafts, [id]: { ...draft } } });
  }
  async submit(id: MissionId): Promise<void> {
    if (this.disposed || this.pending.has(id))
      return;
    let attempt = this.attempts.get(id);
    if (attempt && attempt.kind !== "submit")
      return;
    if (!attempt) {
      if (this.state.status !== "success") return;
      const progress = getProgress(this.state.snapshot, id);
      const draft = this.state.drafts[id] ?? progress.submission ?? { url: "", note: "" };
      if (getMission(id).kind !== "evidence" || !["available", "needs_revision"].includes(progress.status) || !progress.cycleId || Object.keys(validateEvidence(draft)).length)
        return;
      attempt = { kind: "submit", input: {
          ...draft, url: draft.url.trim(), missionId: id, cycleId: progress.cycleId, requestId: crypto.randomUUID()
        } };
    }
    await this.mutate(id, attempt);
  }
  async claim(id: MissionId): Promise<void> {
    if (this.disposed || this.pending.has(id))
      return;
    let attempt = this.attempts.get(id);
    if (attempt && attempt.kind !== "claim")
      return;
    if (!attempt) {
      if (this.state.status !== "success") return;
      const progress = getProgress(this.state.snapshot, id);
      if (progress.status !== "claimable" || !progress.rewardId || this.confirmedRewards.has(progress.rewardId))
        return;
      attempt = { kind: "claim", input: {
          missionId: id, rewardId: progress.rewardId, requestId: crypto.randomUUID()
        } };
    }
    await this.mutate(id, attempt);
  }
  private async mutate(id: MissionId, attempt: Attempt): Promise<void> {
    this.pending.add(id);
    this.attempts.set(id, attempt);
    this.revision++;
    const controller = new AbortController();
    this.controllers.add(controller);
    this.update({ refreshing: false, mutations: { ...this.state.mutations, [id]: { operation: attempt.kind, status: "pending" } } });
    try {
      if (attempt.kind === "submit")
        await this.adapter.submit({ ...attempt.input }, controller.signal);
      else
        await this.adapter.claim({ ...attempt.input }, controller.signal);
      if (this.disposed)
        return;
      this.revision++;
      this.attempts.delete(id);
      if (attempt.kind === "claim")
        this.confirmedRewards.add(attempt.input.rewardId);
      else
        this.submittedCycles.set(id, attempt.input.cycleId);
      const snapshot = this.state.snapshot ? { ...this.state.snapshot, missions: this.state.snapshot.missions.map(p => p.missionId === id && (attempt.kind === "claim" ? p.rewardId === attempt.input.rewardId : p.cycleId === attempt.input.cycleId) ? {
          ...p, status: attempt.kind === "claim" ? "claimed" as const : "reviewing" as const, ...(attempt.kind === "submit" ? { submission: { url: attempt.input.url, note: attempt.input.note } } : {})
        } : p) } : null;
      this.update({ snapshot, mutations: { ...this.state.mutations, [id]: { operation: attempt.kind, status: "success", message: attempt.kind === "claim" ? "보상을 수령했어요." : "검토를 요청했어요." } } });
      if (attempt.kind === "claim") {
        try {
          await this.onClaimed();
        }
        catch {
          if (!this.disposed)
            this.update({ mutations: { ...this.state.mutations, [id]: { operation: attempt.kind, status: "success", message: "보상은 수령했어요. 잔액을 다시 확인해 주세요." } } });
        }
      }
      this.pending.delete(id);
      if (!this.disposed)
        await this.load();
    }
    catch (error) {
      if (this.disposed)
        return;
      const definitive = error instanceof MissionRejectedError || error instanceof MissionUnavailableError;
      if (definitive)
        this.attempts.delete(id);
      this.update({ refreshing: false, mutations: { ...this.state.mutations, [id]: { operation: attempt.kind, status: definitive ? "error" : "uncertain", message: definitive ? "요청을 완료하지 못했어요. 조건을 확인하고 다시 시도해 주세요." : "결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요." } } });
    }
    finally {
      this.pending.delete(id);
      this.controllers.delete(controller);
    }
  }
  dispose(): void {
    this.disposed = true;
    this.controllers.forEach(c => c.abort());
    this.controllers.clear();
    this.attempts.clear();
    this.pending.clear();
    this.confirmedRewards.clear();
    this.submittedCycles.clear();
    this.state = initial();
    this.listeners.clear();
  }
}
