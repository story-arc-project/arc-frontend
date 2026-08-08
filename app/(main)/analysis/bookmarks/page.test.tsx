import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BookmarkedSnapshot, AnalysisType } from "@/types/analysis";

// FRT-185: 이 화면이 지키는 계약은 하나다 — "화면은 마지막에 고른 필터의 답만 보여준다".
// 필터를 빠르게 바꾸면 두 요청이 동시에 떠 있고, 먼저 떠난 쪽이 나중에 돌아올 수 있다.
// 그 늦은 답이 목록·로딩·에러 중 무엇이든 건드리는 순간 탭과 내용이 어긋난다.

vi.mock("@/lib/api/analysis-api", () => ({
  getBookmarks: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

// next/link 는 앱 라우터 컨텍스트를 요구한다 — 표시 검증에는 순수 앵커로 충분하다.
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { getBookmarks } from "@/lib/api/analysis-api";

import BookmarksPage from "./page";

const getList = vi.mocked(getBookmarks);

afterEach(cleanup);

beforeEach(() => {
  // clearAllMocks 는 mockReturnValueOnce 큐를 비우지 않는다 — 한 테스트가 큐를 남기면
  // 다음 테스트가 남의 응답을 받는다. 큐까지 비우려면 reset 이어야 한다.
  getList.mockReset();
  vi.clearAllMocks();
});

function snap(id: string, type: AnalysisType = "individual"): BookmarkedSnapshot {
  return {
    id,
    type,
    title: `분석 ${id}`,
    status: "completed",
    createdAt: "2026-08-01T00:00:00Z",
    experienceCount: 1,
    isBookmarked: true,
    bookmarkedAt: "2026-08-02T00:00:00Z",
  };
}

// 응답 순서를 손으로 정하려면 프로미스를 붙잡고 있어야 한다. reject 도 필요하다 —
// 늦게 도착하는 것이 성공만은 아니기 때문이다.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {});
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("즐겨찾기 목록 — 필터 전환 race (FRT-185)", () => {
  it("먼저 떠난 요청이 뒤늦게 도착해도 지금 고른 필터의 목록을 덮지 않는다", async () => {
    const stale = deferred<BookmarkedSnapshot[]>();
    getList.mockReturnValueOnce(stale.promise); // filter=all (느림)

    const { container } = render(<BookmarksPage />);
    await flush();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();

    const fresh = deferred<BookmarkedSnapshot[]>();
    getList.mockReturnValueOnce(fresh.promise); // filter=individual (현재)
    await click(screen.getByRole("tab", { name: "개별" }));
    await flush();

    await act(async () => {
      fresh.resolve([snap("fresh")]);
    });
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();

    // 뒤늦게 도착한 '전체' 응답.
    await act(async () => {
      stale.resolve([snap("stale", "comprehensive")]);
    });

    expect(screen.queryByText("분석 stale")).not.toBeInTheDocument();
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("새 요청이 아직 진행 중인데 늦은 응답이 로딩을 꺼버리지 않는다", async () => {
    // 로딩을 끄는 것만으로도 화면은 거짓말을 한다 — 스켈레톤이 사라진 자리에
    // 아직 도착하지 않은 필터 대신 옛 목록이 완성된 얼굴로 앉는다.
    const stale = deferred<BookmarkedSnapshot[]>();
    getList.mockReturnValueOnce(stale.promise);

    const { container } = render(<BookmarksPage />);
    await flush();

    const pending = deferred<BookmarkedSnapshot[]>();
    getList.mockReturnValueOnce(pending.promise); // 끝내 응답하지 않는다
    await click(screen.getByRole("tab", { name: "개별" }));
    await flush();

    await act(async () => {
      stale.resolve([snap("stale", "comprehensive")]);
    });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("분석 stale")).not.toBeInTheDocument();
  });

  it("늦게 도착한 옛 요청의 실패는 멀쩡한 화면을 에러로 바꾸지 않는다", async () => {
    const stale = deferred<BookmarkedSnapshot[]>();
    getList.mockReturnValueOnce(stale.promise);

    render(<BookmarksPage />);
    await flush();

    const fresh = deferred<BookmarkedSnapshot[]>();
    getList.mockReturnValueOnce(fresh.promise);
    await click(screen.getByRole("tab", { name: "개별" }));
    await flush();

    await act(async () => {
      fresh.resolve([snap("fresh")]);
    });
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();

    await act(async () => {
      stale.reject(new Error("즐겨찾기를 불러올 수 없습니다."));
    });

    expect(screen.queryByText("데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("에러 화면의 '다시 시도'는 지금 필터로 다시 읽는다", async () => {
    getList.mockRejectedValueOnce(new Error("즐겨찾기를 불러올 수 없습니다."));

    render(<BookmarksPage />);
    await flush();
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();

    getList.mockResolvedValueOnce([snap("retried")]);
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(getList).toHaveBeenCalledTimes(2);
    expect(screen.getByText("분석 retried")).toBeInTheDocument();
  });

  it("'다시 시도'를 누른 직후에는 이전 실패가 아니라 기다리는 중임을 보여준다", async () => {
    getList.mockRejectedValueOnce(new Error("즐겨찾기를 불러올 수 없습니다."));

    const { container } = render(<BookmarksPage />);
    await flush();
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();

    const pending = deferred<BookmarkedSnapshot[]>();
    getList.mockReturnValueOnce(pending.promise);
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
  });

  it("이미 고른 필터를 다시 눌러도 목록이 로딩으로 되돌아가지 않는다", async () => {
    // 요청을 새로 보내지 않는 클릭이라면 로딩도 없어야 한다 — 아니면 영영 끝나지 않는다.
    getList.mockResolvedValueOnce([snap("kept")]);

    const { container } = render(<BookmarksPage />);
    await flush();
    expect(screen.getByText("분석 kept")).toBeInTheDocument();

    await click(screen.getByRole("tab", { name: "전체" }));
    await flush();

    expect(getList).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    expect(screen.getByText("분석 kept")).toBeInTheDocument();
  });

  it("StrictMode 이중 마운트에서도 목록이 뜬다 — 버려지는 건 첫 요청뿐이다", async () => {
    // dev 는 effect 를 mount→cleanup→mount 로 두 번 돌린다. 첫 요청은 cleanup 으로
    // 무시되므로, 두 번째가 화면을 채우지 못하면 목록이 영영 스켈레톤에 머문다.
    getList.mockResolvedValue([snap("mounted")]);

    const { container } = render(
      <StrictMode>
        <BookmarksPage />
      </StrictMode>,
    );
    await flush();

    expect(getList).toHaveBeenCalledTimes(2);
    expect(screen.getByText("분석 mounted")).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
  });
});
