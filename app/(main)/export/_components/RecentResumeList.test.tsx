import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ResumeListItem } from "@/types/resume";

/**
 * FRT-126 — 익스포트 목록의 삭제 확인과 모바일 날짜.
 *
 * 삭제는 브라우저 기본 `window.confirm` 대신 디자인 시스템 Dialog 를 쓴다. 확인 절차가
 * 대화상자로 바뀌었으므로 **취소가 실제로 삭제를 막는지**까지 본다 — confirm 을 걷어내면서
 * 취소 경로가 그대로 삭제로 흐르면 되돌릴 수 없는 데이터가 사라진다.
 */

const mockGetResumeList = vi.fn();
const mockDeleteResume = vi.fn();

vi.mock("@/lib/api/export-api", () => ({
  getResumeList: () => mockGetResumeList(),
  deleteResume: (id: string) => mockDeleteResume(id),
}));

// vi.mock 은 파일 최상단으로 끌어올려지므로 factory 밖 변수를 참조할 수 없다 —
// 목 안에서 만들고, 단언할 때 import 한 toast 를 통해 꺼내 쓴다.
vi.mock("@/components/ui/toast", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }));

import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { RecentResumeList } from "./RecentResumeList";

function item(overrides: Partial<ResumeListItem> = {}): ResumeListItem {
  return {
    version_id: "v1",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    title: "지원용 레쥬메",
    language: "ko",
    status: "completed",
    ...overrides,
  };
}

let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetResumeList.mockResolvedValue([item()]);
  mockDeleteResume.mockResolvedValue(undefined);
  // jsdom 의 confirm 은 호출하면 "not implemented" 를 뱉는다 — 호출 여부만 관찰한다.
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  confirmSpy.mockRestore();
  cleanup();
});

async function renderList() {
  render(<RecentResumeList onCreateClick={() => {}} />);
  await screen.findByText("지원용 레쥬메");
}

describe("RecentResumeList — 삭제 확인", () => {
  it("휴지통을 누르면 브라우저 confirm 대신 확인 대화상자가 뜬다", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByLabelText("레쥬메 삭제"));

    expect(confirmSpy).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("이 레쥬메를 삭제할까요?")).toBeTruthy();
    // 확인 전에는 아무것도 지우지 않는다.
    expect(mockDeleteResume).not.toHaveBeenCalled();
  });

  it("취소하면 대화상자가 닫히고 레쥬메는 그대로 남는다", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByLabelText("레쥬메 삭제"));
    await user.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockDeleteResume).not.toHaveBeenCalled();
    expect(screen.getByText("지원용 레쥬메")).toBeTruthy();
  });

  it("삭제하기를 누르면 삭제되고 목록에서 사라진다", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByLabelText("레쥬메 삭제"));
    await user.click(screen.getByRole("button", { name: "삭제하기" }));

    await waitFor(() => expect(mockDeleteResume).toHaveBeenCalledWith("v1"));
    await waitFor(() => expect(screen.queryByText("지원용 레쥬메")).toBeNull());
    // 삭제가 끝나면 대화상자도 닫힌다.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("삭제에 실패해도 대화상자가 열린 채 남지 않는다", async () => {
    const user = userEvent.setup();
    mockDeleteResume.mockRejectedValue(new Error("boom"));
    await renderList();

    await user.click(screen.getByLabelText("레쥬메 삭제"));
    await user.click(screen.getByRole("button", { name: "삭제하기" }));

    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // 실패했으니 행은 남아 있어야 한다.
    expect(screen.getByText("지원용 레쥬메")).toBeTruthy();
  });

  // 서버에 DELETE 가 실재하므로(FRT-111) 405/501 은 배포 상태에서 나올 수 없다. 그런데도
  // 한 번의 실패를 "이 기능은 없다"로 단정해 **버튼을 숨기면** 사용자는 다시 시도할
  // 방법조차 잃는다 — 되돌릴 길이 없는 UI 는 실패보다 나쁘다.
  it.each([405, 501, 500])(
    "삭제가 %i 로 실패해도 버튼은 그대로 남아 다시 시도할 수 있다",
    async (status) => {
      const user = userEvent.setup();
      mockDeleteResume.mockRejectedValue(new ApiError(status, "unsupported"));
      await renderList();

      await user.click(screen.getByLabelText("레쥬메 삭제"));
      await user.click(screen.getByRole("button", { name: "삭제하기" }));

      await waitFor(() =>
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith("삭제에 실패했어요"),
      );
      // 버튼이 사라지면 사용자는 재시도 자체를 못 한다.
      expect(screen.getByLabelText("레쥬메 삭제")).toBeTruthy();
    },
  );
});

describe("RecentResumeList — 만든 시각", () => {
  it("좁은 화면에서도 만든 시각이 숨겨지지 않는다", async () => {
    await renderList();

    const relative = await screen.findByText(/전$|^—$/);
    // `hidden sm:inline` 이면 sm 미만에서 display:none 이라 값이 통째로 사라진다.
    expect(relative.className).not.toMatch(/\bhidden\b/);
    expect(relative.className).not.toMatch(/\bsm:inline\b/);
  });
});
