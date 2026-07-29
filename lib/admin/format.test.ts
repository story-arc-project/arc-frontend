import { describe, expect, it } from "vitest";

import { formatAdminDate } from "./format";

describe("formatAdminDate", () => {
  it("ISO 날짜를 한국 기준 날짜로 표기한다", () => {
    expect(formatAdminDate("2026-03-14T05:00:00Z")).toBe("2026. 03. 14.");
  });

  // 타임존을 고정하지 않으면 UTC 자정 근처 시각이 실행 환경에 따라 하루 어긋난다.
  // 2026-03-14T20:00:00Z 는 KST 로 3/15 새벽 5시다.
  it("UTC 자정 근처도 한국 날짜로 환산한다", () => {
    expect(formatAdminDate("2026-03-14T20:00:00Z")).toBe("2026. 03. 15.");
  });

  it("값이 없으면 —", () => {
    expect(formatAdminDate("")).toBe("—");
    expect(formatAdminDate(null)).toBe("—");
    expect(formatAdminDate(undefined)).toBe("—");
  });

  // 파싱 못 하는 값을 "Invalid Date" 로 보여주면 운영자가 원본을 확인할 수 없다.
  it("파싱할 수 없는 값은 원문을 그대로 보여준다", () => {
    expect(formatAdminDate("어제")).toBe("어제");
  });
});
