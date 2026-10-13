import { describe, expect, it, vi } from "vitest";
import { MissionStore, MissionRejectedError } from "./store";
import type { MissionAdapter, MissionSnapshot } from "./types";
const snapshot: MissionSnapshot = { version: "1", missions: [{
      missionId: "M2", status: "available", cycleId: "c"
    }, {
      missionId: "M1", status: "claimable", rewardId: "r"
    }] };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
};
const adapter = (): MissionAdapter => ({
  load: vi.fn(async () => snapshot), submit: vi.fn(async () => {
  }), claim: vi.fn(async () => {
  })
});
describe("mission session", () => {
  it("freezes uncertain submission and retries exact request", async () => {
    const a = adapter();
    vi.mocked(a.submit).mockRejectedValueOnce(new Error("lost"));
    const s = new MissionStore(a);
    await s.load();
    s.setDraft("M2", { url: "https://example.com/old", note: "old" });
    await s.submit("M2");
    s.setDraft("M2", { url: "https://example.com/new", note: "new" });
    await s.submit("M2");
    expect(vi.mocked(a.submit).mock.calls[0][0]).toEqual(vi.mocked(a.submit).mock.calls[1][0]);
    expect(s.getSnapshot().mutations.M2?.status).toBe("success");
  });
  it("guards synchronous duplicate claims and keeps success on balance refresh failure", async () => {
    const a = adapter();
    const d = deferred<void>();
    vi.mocked(a.claim).mockReturnValue(d.promise);
    const onClaimed = vi.fn(async () => {
      throw Error("refresh");
    });
    const s = new MissionStore(a, onClaimed);
    await s.load();
    const p = s.claim("M1");
    await s.claim("M1");
    expect(a.claim).toHaveBeenCalledTimes(1);
    d.resolve();
    await p;
    await s.claim("M1");
    expect(a.claim).toHaveBeenCalledTimes(1);
    expect(onClaimed).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot().mutations.M1?.status).toBe("success");
  });
  it("preserves draft after rejection and rotates ID for explicit new submit", async () => {
    const a = adapter();
    vi.mocked(a.submit).mockRejectedValueOnce(new MissionRejectedError("수정해 주세요."));
    const s = new MissionStore(a);
    await s.load();
    s.setDraft("M2", { url: "https://example.com", note: "keep" });
    await s.submit("M2");
    expect(s.getSnapshot().drafts.M2?.note).toBe("keep");
    await s.submit("M2");
    expect(vi.mocked(a.submit).mock.calls[0][0].requestId).not.toBe(vi.mocked(a.submit).mock.calls[1][0].requestId);
  });
  it("ignores disposed claims and aborts the account request", async () => {
    const a = adapter();
    const d = deferred<void>();
    vi.mocked(a.claim).mockReturnValue(d.promise);
    const cb = vi.fn();
    const s = new MissionStore(a, cb);
    await s.load();
    const p = s.claim("M1");
    const signal = vi.mocked(a.claim).mock.calls[0][1];
    s.dispose();
    d.resolve();
    await p;
    expect(signal.aborted).toBe(true);
    expect(cb).not.toHaveBeenCalled();
    expect(s.getSnapshot().snapshot).toBeNull();
  });
  it("does not let a pending load overwrite a successful mutation", async () => {
    const a = adapter();
    const s = new MissionStore(a);
    await s.load();
    const d = deferred<MissionSnapshot>();
    vi.mocked(a.load).mockReturnValueOnce(d.promise);
    const load = s.load();
    await s.claim("M1");
    d.resolve(snapshot);
    await load;
    expect(s.getSnapshot().snapshot?.missions.find(m => m.missionId === "M1")?.status).toBe("claimed");
  });
  it("retries a lost claim using the same reward and ID without early balance refresh", async () => {
    const a = adapter();
    vi.mocked(a.claim).mockRejectedValueOnce(new Error("response lost"));
    const cb = vi.fn();
    const s = new MissionStore(a, cb);
    await s.load();
    await s.claim("M1");
    expect(cb).not.toHaveBeenCalled();
    await s.claim("M1");
    expect(vi.mocked(a.claim).mock.calls[0][0]).toEqual(vi.mocked(a.claim).mock.calls[1][0]);
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it("supports StrictMode retain cleanup and setup, then clears account drafts", async () => {
    const s = new MissionStore(adapter());
    const release = s.retain();
    release();
    const releaseAgain = s.retain();
    await Promise.resolve();
    await s.load();
    expect(s.getSnapshot().status).toBe("success");
    s.setDraft("M2", { url: "https://example.com", note: "private" });
    releaseAgain();
    await Promise.resolve();
    expect(s.getSnapshot().drafts).toEqual({});
  });
  it("permits a newly confirmed reward after an earlier cycle was claimed", async () => {
    const a = adapter();
    const s = new MissionStore(a);
    await s.load();
    await s.claim("M1");
    vi.mocked(a.load).mockResolvedValue({ version: "2", missions: [{
          missionId: "M1", status: "claimable", rewardId: "new"
        }] });
    await s.load();
    await s.claim("M1");
    expect(a.claim).toHaveBeenCalledTimes(2);
  });
  it("keeps a confirmed claim final if its snapshot refresh fails", async () => {
    const a = adapter();
    const s = new MissionStore(a);
    await s.load();
    vi.mocked(a.load).mockRejectedValueOnce(new Error("refresh failed"));
    await s.claim("M1");
    await s.claim("M1");
    expect(a.load).toHaveBeenCalledTimes(2);
    expect(a.claim).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot().mutations.M1?.status).toBe("success");
  });
  it("refreshes a confirmed submission to a revision while preserving its draft", async () => {
    const a = adapter();
    const s = new MissionStore(a);
    await s.load();
    s.setDraft("M2", { url: "https://example.com", note: "my draft" });
    vi.mocked(a.load).mockResolvedValue({ version: "2", missions: [{
          missionId: "M2", status: "needs_revision", cycleId: "c"
        }] });
    await s.submit("M2");
    expect(s.getSnapshot().snapshot?.missions[0].status).toBe("needs_revision");
    expect(s.getSnapshot().drafts.M2?.note).toBe("my draft");
    await s.submit("M2");
    expect(a.submit).toHaveBeenCalledTimes(2);
  });
  it("never changes an uncertain submission into a claim", async () => {
    const a = adapter();
    vi.mocked(a.submit).mockRejectedValue(new Error("lost"));
    const s = new MissionStore(a);
    await s.load();
    s.setDraft("M2", { url: "https://example.com", note: "" });
    await s.submit("M2");
    vi.mocked(a.load).mockResolvedValue({ version: "2", missions: [{
          missionId: "M2", status: "claimable", rewardId: "r2"
        }] });
    await s.load();
    await s.claim("M2");
    expect(a.claim).not.toHaveBeenCalled();
  });
  it("ignores a load started during a pending mutation when it resolves late", async () => {
    const a = adapter();
    const s = new MissionStore(a);
    await s.load();
    const claimResult = deferred<void>();
    vi.mocked(a.claim).mockReturnValueOnce(claimResult.promise);
    const claim = s.claim("M1");
    const stale = deferred<MissionSnapshot>();
    vi.mocked(a.load).mockReturnValueOnce(stale.promise);
    const refresh = s.load();
    claimResult.resolve();
    await claim;
    stale.resolve(snapshot);
    await refresh;
    expect(s.getSnapshot().snapshot?.missions.find(m => m.missionId === "M1")?.status).toBe("claimed");
    expect(s.getSnapshot().refreshing).toBe(false);
  });

  it("blocks fresh mutations after a failed read", async () => {
    const a = adapter(); const s = new MissionStore(a); await s.load();
    s.setDraft("M2", {url: "https://example.com", note: ""});
    vi.mocked(a.load).mockRejectedValueOnce(new Error("offline"));
    await s.load(); await s.submit("M2"); await s.claim("M1");
    expect(a.submit).not.toHaveBeenCalled(); expect(a.claim).not.toHaveBeenCalled();
  });
  it("retains operation and permits immutable uncertain retry after progress advances and read fails", async () => {
    const a = adapter(); vi.mocked(a.submit).mockRejectedValueOnce(new Error("lost"));
    const s = new MissionStore(a); await s.load();
    s.setDraft("M2", {url: "https://example.com", note: ""}); await s.submit("M2");
    vi.mocked(a.load).mockResolvedValueOnce({version: "2", missions: [{missionId: "M2", status: "claimable", rewardId: "r2"}]});
    await s.load();
    expect(s.getSnapshot().mutations.M2?.operation).toBe("submit");
    vi.mocked(a.load).mockRejectedValueOnce(new Error("offline")); await s.load();
    await s.submit("M2");
    expect(vi.mocked(a.submit).mock.calls[0][0]).toEqual(vi.mocked(a.submit).mock.calls[1][0]);
  });
  it("ends refreshing when a load is discarded during a failed mutation", async () => {
    const a = adapter(); const s = new MissionStore(a); await s.load();
    let reject!: (reason: Error) => void;
    vi.mocked(a.claim).mockImplementationOnce(() => new Promise((_, r) => {reject = r;}));
    const claim = s.claim("M1"); await s.load();
    reject(new Error("lost")); await claim;
    expect(s.getSnapshot().refreshing).toBe(false);
    expect(s.getSnapshot().mutations.M1?.operation).toBe("claim");
  });

  it("permits claim after an uncertain submission is confirmed by replay", async () => {
    const a = adapter();
    vi.mocked(a.submit).mockRejectedValueOnce(new Error("lost"));
    const s = new MissionStore(a); await s.load();
    s.setDraft("M2", {url: "https://example.com", note: ""});
    await s.submit("M2");
    vi.mocked(a.load).mockResolvedValue({version: "2", missions: [{missionId: "M2",status: "claimable",rewardId: "r2",cycleId: "c"}]});
    await s.load(); await s.submit("M2"); await s.claim("M2");
    expect(a.claim).toHaveBeenCalledTimes(1);
  });

  it("keeps a newer reward claimable when replay confirms the previous reward", async () => {
    const a = adapter();
    vi.mocked(a.claim).mockRejectedValueOnce(new Error("lost"));
    const s = new MissionStore(a); await s.load(); await s.claim("M1");
    vi.mocked(a.load).mockResolvedValue({version: "2", missions: [{missionId: "M1", status: "claimable", rewardId: "r2"}]});
    await s.load();
    const observed: string[] = [];
    const unsubscribe = s.subscribe(() => {
      const progress = s.getSnapshot().snapshot?.missions[0];
      if (progress?.rewardId === "r2") observed.push(progress.status);
    });
    await s.claim("M1");
    unsubscribe();
    expect(observed).not.toContain("claimed");
    expect(vi.mocked(a.claim).mock.calls[1][0].rewardId).toBe("r");
    expect(s.getSnapshot().snapshot?.missions[0].status).toBe("claimable");
    await s.claim("M1");
    expect(vi.mocked(a.claim).mock.calls[2][0].rewardId).toBe("r2");
    expect(a.claim).toHaveBeenCalledTimes(3);
  });

});
