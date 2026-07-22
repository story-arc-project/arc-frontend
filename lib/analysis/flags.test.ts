import { afterEach, describe, expect, it, vi } from "vitest";

import { isAnalysisRetryEnabled } from "./flags";

describe("isAnalysisRetryEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("env 미설정이면 off (기본 안전값 — BAC-42 미배포 상태)", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYSIS_RETRY_ENABLED", undefined);
    expect(isAnalysisRetryEnabled()).toBe(false);
  });

  it('정확히 "true" 일 때만 켜진다', () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYSIS_RETRY_ENABLED", "true");
    expect(isAnalysisRetryEnabled()).toBe(true);
  });

  it('"true" 가 아닌 값은 전부 off (엄격 문자열 비교)', () => {
    for (const value of ["false", "1", "TRUE", "", "yes", "on"]) {
      vi.stubEnv("NEXT_PUBLIC_ANALYSIS_RETRY_ENABLED", value);
      expect(isAnalysisRetryEnabled()).toBe(false);
    }
  });
});
