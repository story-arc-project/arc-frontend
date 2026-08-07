import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ParsingWarningsBanner } from "./ParsingWarningsBanner";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

/**
 * `useBasePath` 를 통째로 가짜로 바꾸면 "배너가 basePath 를 쓰는가"만 보이고
 * **"데모 URL 에서 실제로 /demo 가 나오는가"는 못 본다** — 훅이 pathname 을 어떻게
 * 읽는지가 이 버그의 핵심이므로 실제 훅을 돌리고 pathname 만 갈아끼운다.
 */
const mockUsePathname = vi.fn(() => "/export/resume/v1");
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

const WARNINGS = ["경력 기간을 해석하지 못했어요"];

function archiveHref(): string | null {
  return screen
    .getByRole("link", { name: /경험 보완하러 가기/ })
    .getAttribute("href");
}

describe("ParsingWarningsBanner", () => {
  it("일반 모드에서는 실제 서비스 아카이브로 보낸다", () => {
    mockUsePathname.mockReturnValue("/export/resume/v1");

    render(<ParsingWarningsBanner warnings={WARNINGS} />);

    expect(archiveHref()).toBe("/archive");
  });

  // 데모 라우트는 이 페이지를 그대로 재노출한다(app/demo/export/resume/[versionId]).
  // 링크가 실제 서비스로 나가면 로그인 벽에 막혀 데모 흐름이 끊긴다.
  it("데모 모드에서는 데모 아카이브로 보낸다", () => {
    mockUsePathname.mockReturnValue("/demo/export/resume/v1");

    render(<ParsingWarningsBanner warnings={WARNINGS} />);

    expect(archiveHref()).toBe("/demo/archive");
  });

  it("경고가 없으면 아무것도 렌더하지 않는다", () => {
    mockUsePathname.mockReturnValue("/export/resume/v1");

    const { container } = render(<ParsingWarningsBanner warnings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
