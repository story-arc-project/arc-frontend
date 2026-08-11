import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { EmptyResumeState } from "./EmptyResumeState";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

// ParsingWarningsBanner 와 같은 이유로 실제 훅을 돌린다(그 테스트의 주석 참고).
const mockUsePathname = vi.fn(() => "/export/resume/v1");
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

function archiveHref(): string | null {
  return screen
    .getByRole("link", { name: "경험 기록하러 가기" })
    .getAttribute("href");
}

describe("EmptyResumeState", () => {
  it("일반 모드에서는 실제 서비스 아카이브로 보낸다", () => {
    mockUsePathname.mockReturnValue("/export/resume/v1");

    render(<EmptyResumeState />);

    expect(archiveHref()).toBe("/archive");
  });

  // 이 빈 상태는 파싱 경고 배너와 **같은 분기에서 나란히** 뜬다(page.tsx 의 isFullyEmpty).
  // 배너만 고치면 바로 아래 이 버튼이 여전히 데모를 이탈시킨다.
  it("데모 모드에서는 데모 아카이브로 보낸다", () => {
    mockUsePathname.mockReturnValue("/demo/export/resume/v1");

    render(<EmptyResumeState />);

    expect(archiveHref()).toBe("/demo/archive");
  });
});
