import { afterEach, describe, expect, it, vi } from "vitest";

import { isFeedbackEnabled } from "./flags";

describe("isFeedbackEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("env 미설정이면 off (기본 안전값)", () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", undefined);
    expect(isFeedbackEnabled()).toBe(false);
  });

  it('정확히 "true" 일 때만 켜진다', () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "true");
    expect(isFeedbackEnabled()).toBe(true);
  });

  it('"true" 가 아닌 값은 전부 off (엄격 문자열 비교)', () => {
    for (const value of ["false", "1", "TRUE", "", "yes", "on"]) {
      vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", value);
      expect(isFeedbackEnabled()).toBe(false);
    }
  });
});
