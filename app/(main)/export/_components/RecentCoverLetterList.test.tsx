import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

/**
 * FRT-258 — 뒤에서 도는 재조회가 화면을 덮어쓴다.
 *
 * 이 목록의 로딩 게이트는 `items === null`, 즉 첫 조회에만 걸린다. 그래서 그 뒤의 재조회는
 * **목록이 조작 가능한 채로** 뒤에서 진행되고, 그동안 사용자가 만든 변경을 늦게 도착한
 * 응답이 통째로 덮는다. 여기 두 테스트가 그 창을 막는 그물이다.
 */
describe("RecentCoverLetterList — 뒤에서 도는 재조회", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const processing = () =>
    item({ id: "c2", title: "만드는 중 자기소개서", status: "processing" });

  it("폴링이 도는 중에 지운 항목을 그 폴링 응답이 되살리지 않는다", async () => {
    vi.useFakeTimers();

    let resolvePoll: (v: CoverLetterListItem[]) => void = () => {};
    mockGetCoverLetterList
      .mockReset()
      // 첫 조회 — '생성 중' 행이 있어 폴링이 시작된다.
      .mockResolvedValueOnce([item(), processing()])
      // 폴링 tick 이 보낸 GET. 삭제가 끝난 **뒤에** 도착시킨다.
      .mockImplementationOnce(
        () =>
          new Promise<CoverLetterListItem[]>((res) => {
            resolvePoll = res;
          }),
      );

    render(<RecentCoverLetterList onCreateClick={() => {}} />);
    await act(async () => {});
    expect(screen.getByText("지원 자기소개서")).toBeTruthy();

    // 폴링 tick 발사 → 두 번째 GET 이 뜬 채로 남는다(목록은 그대로 조작 가능하다).
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(mockGetCoverLetterList).toHaveBeenCalledTimes(2);

    // 그 사이에 **다른** 자기소개서를 지운다.
    fireEvent.click(screen.getAllByLabelText("자기소개서 삭제")[0]);
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));
    await act(async () => {});
    expect(mockDeleteCoverLetter).toHaveBeenCalledWith("c1");
    expect(screen.queryByText("지원 자기소개서")).toBeNull();

    // 삭제 전에 떠난 폴링 응답이 이제 도착한다 — 그 시점 서버는 아직 지운 항목을 갖고 있었다.
    await act(async () => {
      resolvePoll([item(), processing()]);
    });

    expect(screen.queryByText("지원 자기소개서")).toBeNull();
  });

  // 삭제가 "그 순간 떠 있던 응답을 버린다"로 구현되면, 같은 응답에 실려 온 **상태 갱신**까지
  // 함께 버려진다 — 폴링은 완료를 보고 꺼지므로 그 응답이 마지막이면 '생성 중'이 고착된다.
  it("삭제 때문에 같은 폴링 응답의 완료 갱신까지 버리지는 않는다", async () => {
    vi.useFakeTimers();

    let resolvePoll: (v: CoverLetterListItem[]) => void = () => {};
    mockGetCoverLetterList
      .mockReset()
      .mockResolvedValueOnce([item(), processing()])
      .mockImplementationOnce(
        () =>
          new Promise<CoverLetterListItem[]>((res) => {
            resolvePoll = res;
          }),
      );

    render(<RecentCoverLetterList onCreateClick={() => {}} />);
    await act(async () => {});
    expect(screen.getByText("생성 중")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(mockGetCoverLetterList).toHaveBeenCalledTimes(2);

    // 폴링이 떠 있는 채로 **다른** 자기소개서를 지운다.
    fireEvent.click(screen.getAllByLabelText("자기소개서 삭제")[0]);
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));
    await act(async () => {});
    expect(mockDeleteCoverLetter).toHaveBeenCalledWith("c1");

    // 그 폴링이 "다 만들어졌다"를 싣고 도착한다 — 지운 것만 빠지고 완료는 반영돼야 한다.
    await act(async () => {
      resolvePoll([item(), item({ id: "c2", title: "만드는 중 자기소개서" })]);
    });

    expect(screen.queryByText("지원 자기소개서")).toBeNull();
    expect(screen.getByText("만드는 중 자기소개서")).toBeTruthy();
    expect(screen.queryByText("생성 중")).toBeNull();
  });

  it("늦게 도착한 옛 응답이 그 뒤에 시작된 재조회의 결과를 덮지 않는다", async () => {
    let resolveFirst: (v: CoverLetterListItem[]) => void = () => {};
    mockGetCoverLetterList
      .mockReset()
      .mockImplementationOnce(
        () =>
          new Promise<CoverLetterListItem[]>((res) => {
            resolveFirst = res;
          }),
      )
      .mockResolvedValueOnce([item()]);

    const { rerender } = render(
      <RecentCoverLetterList onCreateClick={() => {}} reloadToken={0} />,
    );
    await act(async () => {});

    // 첫 조회가 떠 있는 채로 재조회가 시작되고, 그쪽이 먼저 도착한다.
    rerender(<RecentCoverLetterList onCreateClick={() => {}} reloadToken={1} />);
    await act(async () => {});
    expect(screen.getByText("지원 자기소개서")).toBeTruthy();
    expect(screen.queryByText("만드는 중 자기소개서")).toBeNull();

    // 이제 옛 응답이 도착한다 — 보낸 순서가 늦은 쪽이 이겨야 한다.
    await act(async () => {
      resolveFirst([item(), processing()]);
    });

    expect(screen.queryByText("만드는 중 자기소개서")).toBeNull();
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

/**
 * FRT-319 — 조회 한 번이 실패했다고 보이던 목록을 지우지 않는다.
 *
 * 실패를 `setItems([])` 로 기록하면 두 가지가 한꺼번에 무너진다. ① 잘 떠 있던 목록이
 * 사라지고 에러 박스로 바뀐다 — 사용자는 아무것도 안 했는데 자기 기록이 화면에서 없어진다.
 * ② `items` 가 비면 `hasPending` 도 false 가 돼 폴링이 꺼지는데, 폴링은 스스로
 * 되살아나지 않는다 — '생성 중' 자기소개서가 완성돼도 영영 목록에 나타나지 않는다.
 * 즉 일시적 실패 한 번이 "화면 초기화 + 진행 관측 중단"이라는 영구 상태로 굳는다.
 */
describe("RecentCoverLetterList — 조회 실패", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("재조회가 실패해도 마지막으로 성공한 목록이 화면에 남는다", async () => {
    mockGetCoverLetterList
      .mockReset()
      .mockResolvedValueOnce([item()])
      .mockRejectedValueOnce(new Error("offline"));

    const { rerender } = render(
      <RecentCoverLetterList onCreateClick={() => {}} reloadToken={0} />,
    );
    await screen.findByText("지원 자기소개서");

    rerender(<RecentCoverLetterList onCreateClick={() => {}} reloadToken={1} />);
    await screen.findByRole("status");

    // 목록은 그대로 남고, 실패는 목록을 **대체하지 않는** 배너로 알린다.
    expect(screen.getByText("지원 자기소개서")).toBeTruthy();
    expect(screen.queryByText("목록을 불러오지 못했어요.")).toBeNull();
  });

  it("보여줄 이전 목록이 없는 첫 조회 실패만 전체 에러 화면을 쓴다", async () => {
    mockGetCoverLetterList.mockReset().mockRejectedValue(new Error("offline"));

    render(<RecentCoverLetterList onCreateClick={() => {}} />);

    expect(await screen.findByText("목록을 불러오지 못했어요.")).toBeTruthy();
    // 로딩 스켈레톤에 영원히 갇히지 않는다.
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  it("배너의 '다시 시도'를 누르면 목록을 다시 읽고 배너가 사라진다", async () => {
    mockGetCoverLetterList
      .mockReset()
      .mockResolvedValueOnce([item()])
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([item(), item({ id: "c3", title: "새 자기소개서" })]);

    const { rerender } = render(
      <RecentCoverLetterList onCreateClick={() => {}} reloadToken={0} />,
    );
    await screen.findByText("지원 자기소개서");
    rerender(<RecentCoverLetterList onCreateClick={() => {}} reloadToken={1} />);
    const banner = await screen.findByRole("status");

    fireEvent.click(within(banner).getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByText("새 자기소개서")).toBeTruthy();
  });

  // 이 목록의 폴링은 `hasPending`(= processing 행이 있는가)으로 재예약을 결정한다. 실패가
  // 목록을 비우면 그 판정이 "정말 다 끝났다"와 구분되지 않아 폴링이 꺼진 채 굳는다.
  it("폴링 tick 이 한 번 실패해도 다음 tick 이 예약돼 '생성 중'이 완료로 갱신된다", async () => {
    vi.useFakeTimers();

    mockGetCoverLetterList
      .mockReset()
      .mockResolvedValueOnce([
        item({ id: "c2", title: "만드는 중 자기소개서", status: "processing" }),
      ])
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([
        item({ id: "c2", title: "만드는 중 자기소개서", status: "completed" }),
      ]);

    render(<RecentCoverLetterList onCreateClick={() => {}} />);
    await act(async () => {});
    expect(screen.getByText("생성 중")).toBeTruthy();

    // 실패하는 tick — '생성 중' 행이 살아남아야 다음 tick 이 예약된다.
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    await act(async () => {});
    expect(screen.getByText("생성 중")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    await act(async () => {});

    expect(mockGetCoverLetterList).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("생성 중")).toBeNull();
    expect(screen.getByText("만드는 중 자기소개서")).toBeTruthy();
  });
});


/**
 * FRT-181 - 폴링 게이트가 "진행 중"을 `processing` 하나로만 판정했다.
 *
 * 매퍼는 백엔드의 `pending` 을 **그대로 보존**하고(`mapCoverLetterStatus`), 렌더도 `pending` 을
 * '생성 중'·비활성으로 잘 그린다. 게이트만 그 상태를 몰라서, `pending` 으로 시작한 행은
 * 폴링이 **아예 시작되지 않는다** - 서버가 다 만든 뒤에도 열리지 않고, 예산 소진 안내(수동
 * 새로고침)조차 뜨지 않는다(폴링이 없으니 예산도 소진되지 않는다). 전체 새로고침만 탈출구다.
 *
 * 판정은 분석 목록이 이미 쓰는 `isAnalysisInFlight`(pending || processing)와 같은 것을 쓴다.
 */
describe("RecentCoverLetterList - FRT-181 pending 행도 진행 중이다", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pending 으로 시작한 행도 폴링을 걸어 완료되면 열린다", async () => {
    vi.useFakeTimers();

    mockGetCoverLetterList
      .mockReset()
      // 첫 조회가 pending 을 본다 - 생성 직후 흔한 응답이다.
      .mockResolvedValueOnce([
        item({ id: "c2", title: "만드는 중 자기소개서", status: "pending" }),
      ])
      .mockResolvedValue([
        item({ id: "c2", title: "만드는 중 자기소개서", status: "completed" }),
      ]);

    render(<RecentCoverLetterList onCreateClick={() => {}} />);
    await act(async () => {});
    expect(screen.getByText("생성 중")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    // 폴링이 돌았다면 두 번째 GET 이 있었고, 그 응답으로 행이 열린다.
    expect(mockGetCoverLetterList).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("생성 중")).toBeNull();
    expect(screen.getByRole("link", { name: /만드는 중 자기소개서/ })).toBeTruthy();
  });

  it("완료·실패만 있으면 폴링을 걸지 않는다 - 끝난 목록을 계속 두드리지 않는다", async () => {
    vi.useFakeTimers();

    mockGetCoverLetterList
      .mockReset()
      .mockResolvedValue([
        item({ id: "c1", status: "completed" }),
        item({ id: "c3", title: "실패한 자기소개서", status: "failed" }),
      ]);

    render(<RecentCoverLetterList onCreateClick={() => {}} />);
    await act(async () => {});

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(mockGetCoverLetterList).toHaveBeenCalledTimes(1);
  });
});
