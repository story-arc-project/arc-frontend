import { describe, expect, it } from "vitest";
import { MISSIONS } from "./catalog";
import { normalizeSnapshot, claimableTotal, safeMissionUrl, validateEvidence } from "./model";
describe("mission model", () => {
  it("fixes rewards and retroactive policy", () => {
    expect(MISSIONS.map(m => m.reward)).toEqual([
      60, 40, 10, 20, 15, 5, 5, 3, 2, 2
    ]);
    expect(MISSIONS.filter(m => m.retroactive).map(m => m.id)).toEqual(["M7", "M8", "M9", "M10"]);
  });
  it("rejects empty and malformed snapshots", () => {
    for (const input of [{ version: "1", missions: [] }, { version: "1", missions: [{ missionId: "M1", status: "claimable" }] }])
      expect(() => normalizeSnapshot(input)).toThrow();
  });
  it("fills omissions as unavailable without fabricating a complete total", () => {
    const s = normalizeSnapshot({ version: "1", missions: [{
          missionId: "M2", status: "claimable", rewardId: "r"
        }, { missionId: "M1", status: "reviewing" }] });
    expect(s.missions).toHaveLength(10);
    expect(s.missions.find(m => m.missionId === "M3")?.status).toBe("unavailable");
    expect(claimableTotal(s)).toBeNull();
    expect(claimableTotal(null)).toBeNull();
  });
  it("rejects unsafe evidence and operating URLs", () => {
    for (const u of [
      "javascript:alert(1)",
      "http://example.com",
      "https://localhost/x",
      "https://127.0.0.1",
      "//evil.com",
      "/api/test",
      "https://user:pass@example.com",
      "https://10.0.0.1"
    ])
      expect(safeMissionUrl(u)).toBeUndefined();
    expect(validateEvidence({ url: "https://example.com/review", note: "" })).toEqual({});
    expect(validateEvidence({ url: "https://localhost", note: "" }).url).toBeTruthy();
  });
  it("allows verified ARC destinations only", () => {
    expect(safeMissionUrl("/settings")).toBe("/settings");
    expect(safeMissionUrl("/account")).toBeUndefined();
  });
  it("counts confirmed rewards only when all ten states are known", () => {
    const snapshot = normalizeSnapshot({version: "1", missions: MISSIONS.map(m => ({
      missionId: m.id,
      status: m.id === "M2" ? "claimable" : "reviewing",
      ...(m.id === "M2" ? {rewardId: "r"} : {})
    }))});
    expect(claimableTotal(snapshot)).toBe(40);
    expect(claimableTotal({version: "1", missions: MISSIONS.map(m => ({missionId: m.id, status: "unavailable"}))})).toBeNull();
    expect(claimableTotal({version: "1", missions: []})).toBeNull();
  });

});
