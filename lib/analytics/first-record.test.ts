import { expect, it } from "vitest";
import { markFirstRecordIfUnseen } from "./first-record";
it("does not infer lifetime first completion from counts or local storage", async () => {
  for (const count of [0, 1, 2]) expect(await markFirstRecordIfUnseen(count, "user@example.com")).toBe(false);
});
