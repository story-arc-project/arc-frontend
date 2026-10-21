import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import { isInsufficientCredits } from "./insufficient-credits";

describe("isInsufficientCredits", () => {
  it.each([new ApiError(402, "private amount"), new ApiError(409, "private amount", "INSUFFICIENT_CREDITS")])("recognizes explicit server rejection", (error) => {
    expect(isInsufficientCredits(error)).toBe(true);
  });
  it.each([new ApiError(500, "INSUFFICIENT_CREDITS"), new ApiError(403, "forbidden"), new TypeError("Failed to fetch"), new Error("402"), { status: 402 }, null])("leaves ordinary and network errors alone", (error) => {
    expect(isInsufficientCredits(error)).toBe(false);
  });
});
