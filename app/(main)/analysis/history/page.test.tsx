import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnalysisSnapshot, AnalysisType } from "@/types/analysis";

// FRT-170: 이 화면은 개별·종합·키워드 세 목록을 병합해 보여준다. 그 중 일부만 실패해도
// 예전엔 살아남은 소스만으로 정렬된 목록이 "전체 기록"인 얼굴로 떴다 — 사용자는 특정 유형의
// 기록이 삭제됐다고 오인한다. 여기서 지키는 계약은 둘이다:
//   (1) 못 불러온 유형의 **이름을 댄다**  (2) 실패를 "결과 없음"으로 위장하지 않는다

vi.mock("@/lib/api/analysis-api", () => ({
  getAnalysisHistory: vi.fn(),
  updateAnalysisMeta: vi.fn(),
  deleteAnalysis: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

// next/link 는 앱 라우터 컨텍스트를 요구한다 — 표시 검증에는 순수 앵커로 충분하다.
// 나머지 props 도 그대로 넘긴다: '다시 분석'은 아이콘뿐이라 aria-label 이 유일한 이름이고,
// 그걸 버리면 일반 모드에서도 못 찾게 되어 "데모에서 없다"는 단언이 늘 통과하는 위양성이 된다.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// useBasePath 는 mock 하지 않는다 — 데모 URL 에서 실제로 /demo 가 나오는지가 핵심이다(FRT-161).
const mockUsePathname = vi.fn(() => "/analysis/history");
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

import { getAnalysisHistory } from "@/lib/api/analysis-api";

import HistoryPage from "./page";

const getHistory = vi.mocked(getAnalysisHistory);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePathname.mockReturnValue("/analysis/history");
});

function snap(id: string, type: AnalysisType): AnalysisSnapshot {
  return {
    id,
    type,
    title: `분석 ${id}`,
    status: "completed",
    createdAt: "2026-07-27T00:00:00Z",
    experienceCount: 1,
    isBookmarked: false,
  };
}

async function flush() {
  await act(async () => {});
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function changeSort(value: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("정렬 기준"), { target: { value } });
  });
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

type HistoryResult = { items: AnalysisSnapshot[]; failedTypes: AnalysisType[] };

// FRT-127: 이 목록의 제목은 표시 상태와 편집 상태가 같은 자리에서 교체 렌더된다.
// 두 쪽이 다른 타이포 토큰을 쓰면 제목을 고치려고 누른 순간 글자 크기가 튄다.
describe("분석 기록 목록 — 제목 타이포 (FRT-127)", () => {
  it("제목을 편집해도 글자 크기가 그대로다 — 입력칸이 표시와 같은 토큰을 쓴다", async () => {
    // 개별 분석은 이름 변경이 막혀 있다(버튼 disabled) — 편집 가능한 유형으로 픽스처를 잡는다.
    getHistory.mockResolvedValue({ items: [snap("c1", "comprehensive")], failedTypes: [] });

    render(<HistoryPage />);
    await flush();

    await click(screen.getByRole("button", { name: "이름 변경" }));

    const input = screen.getByLabelText("분석 제목 변경");
    expect(input).toHaveClass("text-title");
    // font-medium(500)이 남으면 .text-title 의 600 을 덮어써 절반만 고친 상태가 된다.
    expect(input).not.toHaveClass("text-body-sm");
    expect(input).not.toHaveClass("font-medium");
  });
});

describe("분석 기록 목록 — 부분 실패 안내 (FRT-170)", () => {
  it("못 불러온 유형의 이름을 대고, 살아남은 기록은 그대로 보여준다", async () => {
    getHistory.mockResolvedValue({
      items: [snap("i1", "individual"), snap("k1", "keyword")],
      failedTypes: ["comprehensive"],
    });

    render(<HistoryPage />);
    await flush();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("종합 분석");
    // 회복력은 그대로 — 살아남은 소스는 계속 보인다.
    expect(screen.getByText("분석 i1")).toBeInTheDocument();
    expect(screen.getByText("분석 k1")).toBeInTheDocument();
  });

  it("실패한 유형이 둘이면 둘 다 이름을 댄다", async () => {
    getHistory.mockResolvedValue({
      items: [snap("c1", "comprehensive")],
      failedTypes: ["individual", "keyword"],
    });

    render(<HistoryPage />);
    await flush();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("개별 분석");
    expect(alert).toHaveTextContent("키워드 분석");
  });

  it("안내의 '다시 시도'는 목록을 다시 읽는다", async () => {
    getHistory.mockResolvedValue({
      items: [snap("i1", "individual")],
      failedTypes: ["comprehensive"],
    });

    render(<HistoryPage />);
    await flush();
    expect(getHistory).toHaveBeenCalledTimes(1);

    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(getHistory).toHaveBeenCalledTimes(2);
  });

  it("실패가 없으면 안내를 띄우지 않는다", async () => {
    getHistory.mockResolvedValue({
      items: [snap("i1", "individual")],
      failedTypes: [],
    });

    render(<HistoryPage />);
    await flush();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("보고 있는 유형이 실패했으면 '아직 분석 결과가 없습니다'로 위장하지 않는다", async () => {
    // 이 버그의 가장 날카로운 형태 — 목록이 비었는데 원인이 실패다.
    // 빈 상태 문구를 그대로 두면 화면이 사용자에게 거짓말을 한다.
    getHistory.mockResolvedValue({ items: [], failedTypes: ["comprehensive"] });

    render(<HistoryPage />);
    await flush();
    await click(screen.getByRole("tab", { name: "종합" }));
    await flush();

    expect(screen.queryByText("아직 분석 결과가 없습니다.")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("종합 분석");
  });

  it("보고 있지 않은 유형의 실패는 알리지 않는다", async () => {
    // 종합 탭의 목록은 키워드 실패와 무관하게 정확하다 — 알릴 '변화'가 없으면 알리지 않는다.
    getHistory.mockResolvedValue({
      items: [snap("c1", "comprehensive")],
      failedTypes: ["keyword"],
    });

    render(<HistoryPage />);
    await flush();
    await click(screen.getByRole("tab", { name: "종합" }));
    await flush();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("분석 c1")).toBeInTheDocument();
  });

  it("정말 아무 기록도 없고 실패도 없으면 기존 빈 상태를 그대로 보여준다", async () => {
    getHistory.mockResolvedValue({ items: [], failedTypes: [] });

    render(<HistoryPage />);
    await flush();

    expect(screen.getByText("아직 분석 결과가 없습니다.")).toBeInTheDocument();
  });

  it("전부 실패(throw)는 기존대로 전체 에러 화면으로 간다", async () => {
    getHistory.mockRejectedValue(new Error("분석 기록을 불러올 수 없습니다."));

    render(<HistoryPage />);
    await flush();

    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();
  });
});

// FRT-185: 이 화면은 필터와 정렬 두 축으로 재조회한다 — 둘 다 빠르게 바꿀 수 있고,
// 그때마다 이전 요청은 취소되지 않은 채 계속 날아온다. 지켜야 할 계약은 하나다:
// **늦게 도착한 옛 응답은 목록도, 로딩도, 에러도, 부분 실패 안내도 건드리지 못한다.**
describe("분석 기록 목록 — 필터·정렬 전환 race (FRT-185)", () => {
  // 앞 describe 가 남긴 영구 mock 구현이 새어 들어오면 Once 큐 뒤로 엉뚱한 응답이 붙는다.
  beforeEach(() => {
    getHistory.mockReset();
  });

  it("먼저 떠난 요청이 뒤늦게 도착해도 지금 고른 필터의 목록을 덮지 않는다", async () => {
    const stale = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(stale.promise); // filter=all (느림)

    render(<HistoryPage />);
    await flush();

    const fresh = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(fresh.promise); // filter=comprehensive (현재)
    await click(screen.getByRole("tab", { name: "종합" }));
    await flush();

    await act(async () => {
      fresh.resolve({ items: [snap("fresh", "comprehensive")], failedTypes: [] });
    });
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();

    await act(async () => {
      stale.resolve({ items: [snap("stale", "individual")], failedTypes: [] });
    });

    expect(screen.queryByText("분석 stale")).not.toBeInTheDocument();
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("정렬 전환도 같은 방어를 받는다 — 옛 정렬의 응답이 뒤늦게 와도 버린다", async () => {
    const stale = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(stale.promise); // sort=newest (느림)

    render(<HistoryPage />);
    await flush();

    const fresh = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(fresh.promise); // sort=oldest (현재)
    await changeSort("oldest");
    await flush();

    await act(async () => {
      fresh.resolve({ items: [snap("fresh", "individual")], failedTypes: [] });
    });
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();

    await act(async () => {
      stale.resolve({ items: [snap("stale", "individual")], failedTypes: [] });
    });

    expect(screen.queryByText("분석 stale")).not.toBeInTheDocument();
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("새 요청이 아직 진행 중인데 늦은 응답이 로딩을 꺼버리지 않는다", async () => {
    const stale = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(stale.promise);

    const { container } = render(<HistoryPage />);
    await flush();

    const pending = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(pending.promise); // 끝내 응답하지 않는다
    await click(screen.getByRole("tab", { name: "종합" }));
    await flush();

    await act(async () => {
      stale.resolve({ items: [snap("stale", "individual")], failedTypes: [] });
    });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("분석 stale")).not.toBeInTheDocument();
  });

  it("늦게 도착한 옛 요청의 실패는 멀쩡한 화면을 에러로 바꾸지 않는다", async () => {
    const stale = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(stale.promise);

    render(<HistoryPage />);
    await flush();

    const fresh = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(fresh.promise);
    await click(screen.getByRole("tab", { name: "종합" }));
    await flush();

    await act(async () => {
      fresh.resolve({ items: [snap("fresh", "comprehensive")], failedTypes: [] });
    });
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();

    await act(async () => {
      stale.reject(new Error("분석 기록을 불러올 수 없습니다."));
    });

    expect(screen.queryByText("데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("늦게 도착한 옛 응답의 부분 실패로 없던 안내를 띄우지 않는다", async () => {
    const stale = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(stale.promise); // sort=newest, 종합이 실패했던 시점

    render(<HistoryPage />);
    await flush();

    const fresh = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(fresh.promise);
    await changeSort("oldest");
    await flush();

    await act(async () => {
      fresh.resolve({ items: [snap("fresh", "individual")], failedTypes: [] });
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      stale.resolve({
        items: [snap("stale", "individual")],
        failedTypes: ["comprehensive"],
      });
    });

    // 지금 목록은 멀쩡하다 — 옛 요청이 겪은 실패를 지금 화면의 사실로 옮기면 거짓 경고다.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // 안내가 없다는 것만으로는 부족하다 — 화면이 로딩으로 되돌아가 안내가 가려진 것도
    // 같은 모습이기 때문이다. 지금 목록이 그대로 서 있어야 진짜 무시한 것이다.
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("늦게 도착한 옛 응답의 성공이 지금의 부분 실패 안내를 지우지 않는다", async () => {
    const stale = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(stale.promise);

    render(<HistoryPage />);
    await flush();

    const fresh = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(fresh.promise);
    await changeSort("oldest");
    await flush();

    await act(async () => {
      fresh.resolve({
        items: [snap("fresh", "individual")],
        failedTypes: ["comprehensive"],
      });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("종합 분석");

    await act(async () => {
      stale.resolve({ items: [snap("stale", "individual")], failedTypes: [] });
    });

    // 반대 방향도 같다 — 옛 요청이 성공했다고 지금의 실패가 없던 일이 되지 않는다.
    expect(screen.getByRole("alert")).toHaveTextContent("종합 분석");
    expect(screen.getByText("분석 fresh")).toBeInTheDocument();
  });

  it("'다시 시도'를 누른 직후에는 이전 실패가 아니라 기다리는 중임을 보여준다", async () => {
    getHistory.mockRejectedValueOnce(new Error("분석 기록을 불러올 수 없습니다."));

    const { container } = render(<HistoryPage />);
    await flush();
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();

    const pending = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(pending.promise);
    await click(screen.getByRole("button", { name: "다시 시도" }));
    await flush();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
  });

  it("정렬을 되돌려와도 이전 실패가 아니라 새로 기다리는 중임을 보여준다", async () => {
    // 두 축 중 어느 쪽으로 나갔다 돌아오든 같다 — 되돌아온 선택도 새 요청이다.
    getHistory.mockRejectedValueOnce(new Error("분석 기록을 불러올 수 없습니다.")); // newest 실패

    const { container } = render(<HistoryPage />);
    await flush();
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();

    const pendingOther = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(pendingOther.promise);
    await changeSort("oldest");
    await flush();

    const pendingBack = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(pendingBack.promise);
    await changeSort("newest");
    await flush();

    expect(getHistory).toHaveBeenCalledTimes(3);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
  });

  it("실패한 필터로 되돌아와도 마찬가지다 — 필터 축도 같은 규칙을 받는다", async () => {
    getHistory.mockRejectedValueOnce(new Error("분석 기록을 불러올 수 없습니다.")); // all 실패

    const { container } = render(<HistoryPage />);
    await flush();
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();

    const pendingOther = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(pendingOther.promise);
    await click(screen.getByRole("tab", { name: "종합" }));
    await flush();

    const pendingBack = deferred<HistoryResult>();
    getHistory.mockReturnValueOnce(pendingBack.promise);
    await click(screen.getByRole("tab", { name: "전체" }));
    await flush();

    expect(getHistory).toHaveBeenCalledTimes(3);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText("데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
  });
});

// 데모는 둘러보기만 한다. 특히 '다시 분석'은 /new 로 가는데 데모엔 그 라우트가 없다 —
// 그대로 두면 이 화면을 여는 것 자체가 새 데드엔드를 만든다(FRT-232).
describe("데모 모드 — 둘러보기만 남긴다 (FRT-232)", () => {
  it("이름 변경·다시 분석·삭제가 모두 사라진다", async () => {
    mockUsePathname.mockReturnValue("/demo/analysis/history");
    getHistory.mockResolvedValue({ items: [snap("c1", "comprehensive")], failedTypes: [] });

    render(<HistoryPage />);
    await flush();

    expect(screen.queryByRole("button", { name: "이름 변경" })).toBeNull();
    expect(screen.queryByRole("link", { name: "다시 분석" })).toBeNull();
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
    expect(screen.queryByRole("button", { name: "즐겨찾기" })).toBeNull();
  });

  it("항목 제목 링크와 빈 상태 CTA 는 데모 안에 머문다", async () => {
    mockUsePathname.mockReturnValue("/demo/analysis/history");
    getHistory.mockResolvedValue({ items: [snap("c1", "comprehensive")], failedTypes: [] });

    render(<HistoryPage />);
    await flush();

    expect(screen.getByRole("link", { name: /분석 c1/ })).toHaveAttribute(
      "href",
      "/demo/analysis/comprehensive/c1",
    );
  });

  it("빈 상태 CTA 는 데모 아카이브로 보낸다", async () => {
    mockUsePathname.mockReturnValue("/demo/analysis/history");
    getHistory.mockResolvedValue({ items: [], failedTypes: [] });

    render(<HistoryPage />);
    await flush();

    expect(screen.getByRole("link", { name: "경험 기록하러 가기" })).toHaveAttribute(
      "href",
      "/demo/archive",
    );
  });

  it("일반 모드는 그대로다 (거울상 — 데모 분기가 본계약을 먹지 않았는지)", async () => {
    getHistory.mockResolvedValue({ items: [snap("c1", "comprehensive")], failedTypes: [] });

    render(<HistoryPage />);
    await flush();

    expect(screen.getByRole("button", { name: "이름 변경" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 분석" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /분석 c1/ })).toHaveAttribute(
      "href",
      "/analysis/comprehensive/c1",
    );
  });
});
