import { describe, expect, it } from "vitest";
import { createMissionMock } from "./missions";
const signal = () => new AbortController().signal;
describe("mission preview server", () => {
  it("models committed claim response loss and same-id retry without a second grant", async () => {
    const mock = createMissionMock({ scenario: "claim-loss" });
    const input = { missionId: "M7" as const, rewardId: "preview-M7-1", requestId: "same" };
    await expect(mock.adapter.claim(input, signal())).rejects.toThrow();
    expect(await mock.readBalance(signal())).toBe(17);
    await mock.adapter.claim(input, signal());
    expect(await mock.readBalance(signal())).toBe(17);
    expect(mock.claims).toHaveLength(1);
  });
  it("models submission response loss without duplicate submissions", async () => {
    const mock = createMissionMock({ scenario: "submit-loss" });
    const input = { missionId: "M2" as const, cycleId: "preview-cycle", requestId: "same", url: "https://example.com/review", note: "real feedback" };
    await expect(mock.adapter.submit(input, signal())).rejects.toThrow();
    await mock.adapter.submit(input, signal());
    expect(mock.submissions).toHaveLength(1);
    expect((await mock.adapter.load(signal())).missions.find(m => m.missionId === "M2")?.status).toBe("reviewing");
  });
  it("requires approval before claiming submitted evidence", async () => {
    const mock = createMissionMock();
    await expect(mock.adapter.claim({ missionId: "M2", rewardId: "preview-M2-1", requestId: "a" }, signal())).rejects.toThrow();
    mock.approve("M2");
    await mock.adapter.claim({ missionId: "M2", rewardId: "preview-M2-1", requestId: "b" }, signal());
    expect(await mock.readBalance(signal())).toBe(52);
  });
  it("rejects reused request identity with a changed payload", async () => {
    const mock = createMissionMock();
    const input = { missionId: "M2" as const, cycleId: "preview-cycle", requestId: "same", url: "https://example.com/review", note: "original" };
    await mock.adapter.submit(input, signal());
    await expect(mock.adapter.submit({ ...input, note: "changed" }, signal())).rejects.toThrow();
  });
});
