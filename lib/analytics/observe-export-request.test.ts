import { describe, expect, it, vi } from "vitest";
const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ capture }));
import { observeExportRequest } from "./observe-export-request";
describe("observeExportRequest", () => {
  it("settles once and preserves success when capture throws", async () => {
    capture.mockImplementation(() => { throw new Error("analytics"); });
    await expect(observeExportRequest(() => Promise.resolve("id"), { export_type: "resume", language: "ko" }, () => true)).resolves.toBe("id");
    expect(capture).toHaveBeenCalledTimes(1);
  });
  it("preserves rejection and suppresses stale outcomes", async () => {
    capture.mockClear();
    const error = new Error("raw");
    await expect(observeExportRequest(() => Promise.reject(error), { export_type: "cover_letter", question_count: 0 }, () => false)).rejects.toBe(error);
    expect(capture).not.toHaveBeenCalled();
  });
});

it("records resolved acceptance even after the caller timeout flag flips", async () => {
  capture.mockReset();
  await expect(observeExportRequest(() => Promise.resolve("id"), { export_type: "resume", language: "ko" }, () => true, { timedOut: () => true })).resolves.toBe("id");
  expect(capture).toHaveBeenCalledWith("export_requested", { export_type: "resume", language: "ko", accepted: true, request_result: "success" });
});

it("records rejection before rethrowing even when capture throws", async () => {
  capture.mockReset().mockImplementation(() => { throw new Error("capture"); });
  const error = new TypeError("network");
  await expect(observeExportRequest(() => Promise.reject(error), { export_type: "resume", language: "ko" }, () => true)).rejects.toBe(error);
  expect(capture).toHaveBeenCalledTimes(1);
});
