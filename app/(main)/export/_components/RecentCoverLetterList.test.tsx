import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CoverLetterListItem } from "@/types/cover-letter";

/**
 * FRT-126 — 자기소개서 목록의 삭제 확인과 모바일 날짜.
 *
 * 레쥬메 목록과 나란히 같은 /export 화면에 놓이므로 확인 절차의 생김새가 갈리면 안 된다
 * (한쪽만 브라우저 confirm 이면 이슈가 지적한 불일치가 한 화면 안에서 드러난다).
 */

const mockGetCoverLetterList = vi.fn();
const mockDeleteCoverLetter = vi.fn();

vi.mock("@/lib/api/cover-letter-api", () => ({
  getCoverLetterList: () => mockGetCoverLetterList(),
  deleteCoverLetter: (id: string) => mockDeleteCoverLetter(id),
  CoverLetterMutationUnsupportedError: class CoverLetterMutationUnsupportedError extends Error {},
}));

vi.mock("@/components/ui/toast", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }));

import { toast } from "@/components/ui/toast";
import { RecentCoverLetterList } from "./RecentCoverLetterList";

function item(overrides: Partial<CoverLetterListItem> = {}): CoverLetterListItem {
  return {
    id: "c1",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    title: "지원 자기소개서",
    // completed 로 둬 목록 폴링(processing 일 때만 돈다)이 테스트에 끼어들지 않게 한다.
    status: "completed",
    ...overrides,
  };
}

let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCoverLetterList.mockResolvedValue([item()]);
  mockDeleteCoverLetter.mockResolvedValue(undefined);
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  confirmSpy.mockRestore();
  cleanup();
});

async function renderList() {
  render(<RecentCoverLetterList onCreateClick={() => {}} />);
  await screen.findByText("지원 자기소개서");
}

describe("RecentCoverLetterList — 삭제 확인", () => {
  it("휴지통을 누르면 브라우저 confirm 대신 확인 대화상자가 뜬다", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByLabelText("자기소개서 삭제"));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("이 자기소개서를 삭제할까요?")).toBeTruthy();
    expect(mockDeleteCoverLetter).not.toHaveBeenCalled();
  });

  it("취소하면 대화상자가 닫히고 자기소개서는 그대로 남는다", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByLabelText("자기소개서 삭제"));
    await user.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockDeleteCoverLetter).not.toHaveBeenCalled();
    expect(screen.getByText("지원 자기소개서")).toBeTruthy();
  });

  it("삭제하기를 누르면 삭제되고 목록에서 사라진다", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByLabelText("자기소개서 삭제"));
    await user.click(screen.getByRole("button", { name: "삭제하기" }));

    await waitFor(() => expect(mockDeleteCoverLetter).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryByText("지원 자기소개서")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("삭제에 실패해도 대화상자가 열린 채 남지 않는다", async () => {
    const user = userEvent.setup();
    mockDeleteCoverLetter.mockRejectedValue(new Error("boom"));
    await renderList();

    await user.click(screen.getByLabelText("자기소개서 삭제"));
    await user.click(screen.getByRole("button", { name: "삭제하기" }));

    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("지원 자기소개서")).toBeTruthy();
  });
});

describe("RecentCoverLetterList — 만든 시각", () => {
  it("좁은 화면에서도 만든 시각이 숨겨지지 않는다", async () => {
    await renderList();

    const relative = await screen.findByText(/전$|^—$/);
    expect(relative.className).not.toMatch(/\bhidden\b/);
    expect(relative.className).not.toMatch(/\bsm:inline\b/);
  });
});
