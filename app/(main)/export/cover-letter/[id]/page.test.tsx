import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CoverLetterResult } from "@/types/cover-letter";

/**
 * FRT-238 — 자기소개서를 빠르게 갈아탈 때 늦게 도착한 이전 요청의 응답.
 *
 * 레쥬메 상세와 같은 결함이 이 파일에도 복제돼 있었다. App Router 는 id 만 바뀌면 같은
 * 컴포넌트 인스턴스를 재사용하므로, 이전 조회가 아직 날아다니는 채로 다음 조회가 시작되고
 * 늦게 도착한 쪽이 화면을 덮는다.
 *
 * 자소서 화면은 플래그가 꺼져 있어 브라우저로 열어볼 수 없다 — **이 파일이 유일한 증거다.**
 */

const mockGetCoverLetter = vi.fn();
const mockUpdateCoverLetter = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/utils/use-base-path", () => ({ useBasePath: () => "" }));

vi.mock("@/components/ui/toast", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

// 에러 타입 판별(CoverLetterNotReadyError 등)이 화면 분기를 가르므로 실제 클래스를 남긴다.
vi.mock("@/lib/api/cover-letter-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/cover-letter-api")>();
  return {
    ...actual,
    getCoverLetter: (...args: unknown[]) => mockGetCoverLetter(...args),
    updateCoverLetter: (...args: unknown[]) => mockUpdateCoverLetter(...args),
  };
});

// capture 만 가짜다 — 계측이 **언제** 발화하는지가 단언 대상이라 나머지는 진짜여야 한다.
vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, capture: vi.fn() };
});

import { writeDraft } from "@/lib/export/cover-letter-draft";
import { __resetMemoryDrafts } from "@/lib/export/draft-storage";
import { toast } from "@/components/ui/toast";
import { capture } from "@/lib/analytics";
import CoverLetterDetailPage from "./page";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fixture(
  body: string,
  overrides: Partial<CoverLetterResult> = {},
): CoverLetterResult {
  return {
    answers: [
      {
        question: "지원 동기를 알려주세요",
        cover_letter: body,
        grounding: { grounded: true, unsupported_claims: [], notes: "" },
      },
    ],
    created_at: "2026-07-21T00:00:00Z",
    ...overrides,
  };
}

/** 조회를 id 별로 붙잡아 둔다. 같은 id 로 두 번 부르면 각각 다른 응답을 쥔다. */
function routeById() {
  const calls = new Map<string, Deferred<CoverLetterResult>[]>();
  mockGetCoverLetter.mockReset();
  mockGetCoverLetter.mockImplementation((id: string) => {
    const d = deferred<CoverLetterResult>();
    const list = calls.get(id) ?? [];
    list.push(d);
    calls.set(id, list);
    return d.promise;
  });
  const at = (id: string, nth: number) => {
    const list = calls.get(id);
    if (!list?.[nth]) {
      throw new Error(
        `${id} 의 ${nth}번째 조회가 아직 없다 (실제 ${list?.length ?? 0}회)`,
      );
    }
    return list[nth];
  };
  return {
    resolve: (id: string, data: CoverLetterResult, nth = 0) =>
      at(id, nth).resolve(data),
    reject: (id: string, reason: unknown, nth = 0) => at(id, nth).reject(reason),
  };
}

function paramsFor(id: string) {
  return Promise.resolve({ id });
}

/** 로드 완료를 기다리지 않는다 — 진행 중인 상태 자체가 검증 대상이다. */
async function renderId(id: string) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={null}>
        <CoverLetterDetailPage params={paramsFor(id)} />
      </Suspense>,
    );
  });
  return result;
}

/**
 * key 를 바꾸지 않는 rerender 여야 한다. key 를 갈면 언마운트-재마운트라
 * "같은 인스턴스가 재사용된다"는 이 버그의 전제 자체가 사라진다.
 */
async function navigateTo(result: ReturnType<typeof render>, id: string) {
  await act(async () => {
    result.rerender(
      <Suspense fallback={null}>
        <CoverLetterDetailPage params={paramsFor(id)} />
      </Suspense>,
    );
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** 지금 화면에 실린 본문 — 편집기가 없으면 null. */
function shownBody(): string | null {
  const box = screen.queryByRole("textbox", {
    name: "문항 1 자기소개서 본문",
  });
  return box ? (box as HTMLTextAreaElement).value : null;
}

function loadingShown(): boolean {
  return document.querySelector('[aria-busy="true"]') !== null;
}

// Vitest 는 globals:false 라 testing-library 의 자동 cleanup 이 등록되지 않는다.
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks 는 once 큐를 비우지 않는다 — 남으면 다음 테스트가 남의 응답을 받는다.
  mockGetCoverLetter.mockReset();
  window.localStorage.clear();
  // draft 는 이제 아래 계층으로도 떨어진다(FRT-261). 셋 다 비우지 않으면 앞 테스트의
  // 편집이 다음 테스트의 복원 배너로 되살아난다.
  window.sessionStorage.clear();
  __resetMemoryDrafts();
});

describe("FRT-238 — 자기소개서 전환 중 늦게 도착한 응답", () => {
  it("A→B 로 옮긴 뒤 늦게 도착한 A 응답이 B 화면을 덮지 않는다", async () => {
    const route = routeById();
    const result = await renderId("A");
    await navigateTo(result, "B");

    route.resolve("B", fixture("B의 자기소개서"));
    await flush();
    expect(shownBody()).toBe("B의 자기소개서");

    route.resolve("A", fixture("A의 자기소개서"));
    await flush();
    expect(shownBody()).toBe("B의 자기소개서");
  });

  it("B 를 기다리는 동안 늦은 A 응답이 로딩을 꺼버리지 않는다", async () => {
    const route = routeById();
    const result = await renderId("A");
    await navigateTo(result, "B");

    route.resolve("A", fixture("A의 자기소개서"));
    await flush();

    expect(shownBody()).toBeNull();
    expect(loadingShown()).toBe(true);
  });

  it("늦게 도착한 A 의 실패가 B 화면을 에러로 바꾸지 않는다", async () => {
    const route = routeById();
    const result = await renderId("A");
    await navigateTo(result, "B");

    route.resolve("B", fixture("B의 자기소개서"));
    await flush();

    route.reject("A", new Error("late failure"));
    await flush();

    expect(screen.queryByText("자기소개서를 불러오지 못했어요")).toBeNull();
    expect(shownBody()).toBe("B의 자기소개서");
  });

  it("A→B→A 로 되돌아오면 캐시된 옛 내용이 아니라 로딩을 보여준다", async () => {
    const route = routeById();
    const result = await renderId("A");
    route.resolve("A", fixture("A의 자기소개서"));
    await flush();
    expect(shownBody()).toBe("A의 자기소개서");

    await navigateTo(result, "B");
    await navigateTo(result, "A");

    expect(loadingShown()).toBe(true);
    expect(shownBody()).toBeNull();
  });

  it("늦게 도착한 A 응답은 A 의 임시저장도 검증 기준선도 건드리지 않는다", async () => {
    // 서버 본문이 draft 보다 새로우므로, 가드가 없으면 이 응답이 draft 를 지운다.
    // localStorage 삭제도, 기준선 최초 기록도 되돌릴 수 없다.
    writeDraft("A", fixture("사용자가 쓰던 초안"));
    const serverNewerThanDraft = fixture("A의 자기소개서", {
      created_at: "2099-01-01T00:00:00Z",
    });

    const route = routeById();
    const result = await renderId("A");
    await navigateTo(result, "B");
    route.resolve("B", fixture("B의 자기소개서"));
    await flush();

    route.resolve("A", serverNewerThanDraft);
    await flush();

    expect(
      window.localStorage.getItem("arc:cover-letter-draft:A"),
    ).not.toBeNull();
    expect(
      window.localStorage.getItem("arc:cover-letter-verified:A"),
    ).toBeNull();
  });

  it("에러 화면의 '다시 시도'는 지금 보고 있는 자기소개서로 다시 읽는다", async () => {
    mockGetCoverLetter.mockReset();
    mockGetCoverLetter
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(fixture("재시도됨"));

    await renderId("B");
    await screen.findByText("자기소개서를 불러오지 못했어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByRole("textbox", { name: "문항 1 자기소개서 본문" }))
      .toHaveValue("재시도됨");
    expect(mockGetCoverLetter).toHaveBeenCalledTimes(2);
    expect(mockGetCoverLetter).toHaveBeenLastCalledWith("B");
  });

  it("실패 후 다시 시도가 성공하면 에러 화면이 사라진다", async () => {
    mockGetCoverLetter.mockReset();
    mockGetCoverLetter
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(fixture("복구됨"));

    await renderId("A");
    await screen.findByText("자기소개서를 불러오지 못했어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    await screen.findByRole("textbox", { name: "문항 1 자기소개서 본문" });
    expect(screen.queryByText("자기소개서를 불러오지 못했어요")).toBeNull();
  });

  it("'다시 시도'를 누른 직후에는 옛 실패 화면이 아니라 로딩을 보여준다", async () => {
    const pending: Deferred<CoverLetterResult>[] = [];
    mockGetCoverLetter.mockReset();
    mockGetCoverLetter.mockImplementationOnce(() =>
      Promise.reject(new Error("boom")),
    );
    mockGetCoverLetter.mockImplementation(() => {
      const d = deferred<CoverLetterResult>();
      pending.push(d);
      return d.promise;
    });

    await renderId("A");
    await screen.findByText("자기소개서를 불러오지 못했어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(loadingShown()).toBe(true);
    expect(screen.queryByText("자기소개서를 불러오지 못했어요")).toBeNull();
    expect(pending).toHaveLength(1);
  });

  it("재시도 응답이 늦어 그 사이 다른 자기소개서로 옮기면, 늦은 응답이 새 화면을 덮지 않는다", async () => {
    const pending: Deferred<CoverLetterResult>[] = [];
    mockGetCoverLetter.mockReset();
    mockGetCoverLetter.mockImplementationOnce(() =>
      Promise.reject(new Error("boom")),
    );
    mockGetCoverLetter.mockImplementation(() => {
      const d = deferred<CoverLetterResult>();
      pending.push(d);
      return d.promise;
    });

    const result = await renderId("A");
    await screen.findByText("자기소개서를 불러오지 못했어요");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    await navigateTo(result, "B");

    // pending[0] = A 의 재시도, pending[1] = B 의 첫 조회
    pending[1].resolve(fixture("B의 자기소개서"));
    await flush();
    expect(shownBody()).toBe("B의 자기소개서");

    pending[0].resolve(fixture("A의 자기소개서"));
    await flush();
    expect(shownBody()).toBe("B의 자기소개서");
  });

  it("전환 중 Ctrl+S 를 눌러도 옛 문서 내용이 새 id 로 저장되지 않는다", async () => {
    // 읽기 경로는 가드가 닫았지만 **쓰기 경로**는 별개다. id 는 prop 이라 즉시 바뀌는 반면
    // result/dirty 는 새 응답이 올 때까지 옛 문서 것이다. 저장 버튼은 이 창에 렌더되지
    // 않지만 전역 Ctrl/Cmd+S 리스너는 살아 있어, 가드가 없으면 그 한 번의 키가
    // **A 의 내용을 B 의 id 로** PATCH 한다.
    const route = routeById();
    const result = await renderId("A");
    route.resolve("A", fixture("A의 자기소개서"));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    expect(shownBody()).toBe("A의 자기소개서!");

    await navigateTo(result, "B");
    expect(loadingShown()).toBe(true);

    await act(async () => {
      fireEvent.keyDown(window, { key: "s", metaKey: true });
    });

    expect(mockUpdateCoverLetter).not.toHaveBeenCalled();
  });
});

/**
 * FRT-191 — 저장에 **성공**해도 남던 복원 배너. 레쥬메 상세와 같은 결함이 여기에도 복제돼
 * 있었다: 실패 갈래에만 `setPendingDraft(null)` 이 있고 성공 갈래에는 없었다.
 *
 * 이 화면은 플래그가 꺼져 있어 브라우저로 확인할 수 없다 — 이 테스트가 유일한 증거다.
 */
describe("FRT-191 — 저장 성공 후 남는 복원 배너", () => {
  const OLD_DRAFT_BODY = "지난 세션에 고친 본문";

  /** 서버 created_at(2026-07-21)보다 뒤인 draft — 복원 배너가 뜬다. */
  function seedOlderDraft(id: string) {
    window.localStorage.setItem(
      `arc:cover-letter-draft:${id}`,
      JSON.stringify({
        data: fixture(OLD_DRAFT_BODY),
        updated_at: "2026-07-22T00:00:00Z",
      }),
    );
  }

  function storedDraft(id: string): { data: CoverLetterResult } | null {
    const raw = window.localStorage.getItem(`arc:cover-letter-draft:${id}`);
    return raw ? (JSON.parse(raw) as { data: CoverLetterResult }) : null;
  }

  it("저장에 성공하면 복원 배너가 사라진다", async () => {
    const route = routeById();
    seedOlderDraft("A");
    mockUpdateCoverLetter.mockImplementation(async (_id, data) => data);
    await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();

    // 배너가 실재하는 상태에서 출발했음을 먼저 못박는다 — 없으면 단언이 공허하게 통과한다.
    expect(screen.getByRole("button", { name: "복원" })).toBeTruthy();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    await user.click(screen.getByRole("button", { name: "저장" }));
    await flush();

    expect(screen.queryByRole("button", { name: "복원" })).toBeNull();
    expect(storedDraft("A")).toBeNull();
  });

  // 저장이 도는 동안 이어 고쳐도 낡은 draft 가 저장소에 남으면 안 된다 — 탭을 그냥 닫으면
  // 다음 진입 때 그것이 배너로 되살아나 방금 저장한 내용을 되돌린다. 이어 고친 편집은 화면과
  // dirty 에 살아 있어 이탈 경로가 남기므로 여기서 draft 를 새로 만들지 않는다.
  it("저장 중에 이어 고쳐도 옛 draft 는 저장소에 남지 않는다", async () => {
    const route = routeById();
    seedOlderDraft("A");
    const save = deferred<CoverLetterResult>();
    mockUpdateCoverLetter.mockImplementation(() => save.promise);
    await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();

    const user = userEvent.setup();
    const box = screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" });
    await user.type(box, "!");
    await user.click(screen.getByRole("button", { name: "저장" }));

    // 요청이 도는 동안 이어서 고친다 — 서버가 받아간 스냅샷에는 이 편집이 없다.
    await user.type(box, "?");

    await act(async () => {
      save.resolve(fixture("서버 본문!"));
    });
    await flush();

    expect(screen.queryByRole("button", { name: "복원" })).toBeNull();
    expect(storedDraft("A")).toBeNull();
  });

  // 저장 응답이 도는 동안 다른 문서로 옮기면, 클로저의 id 는 **이전** 문서인데 resultRef 는
  // 이미 **다음** 문서 본문이다(같은 인스턴스 재사용 — FRT-238). 그 조합으로 임시 저장을
  // 쓰면 남의 본문이 이전 문서의 키에 심겨, 다음 진입 때 배너가 그것을 덮어쓴다.
  it("저장 도중 다른 문서로 옮기면 그 문서 본문이 이전 문서의 임시 저장에 심기지 않는다", async () => {
    const route = routeById();
    const save = deferred<CoverLetterResult>();
    mockUpdateCoverLetter.mockImplementation(() => save.promise);
    const result = await renderId("A");
    route.resolve("A", fixture("에이 본문"));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    await user.click(screen.getByRole("button", { name: "저장" }));

    // B 로 옮긴다 — 이 전환의 cleanup 이 A 의 편집을 A 의 키에 이미 남긴다.
    await navigateTo(result, "B");
    route.resolve("B", fixture("비 본문"));
    await flush();

    // 이제서야 A 의 저장 응답이 도착한다.
    await act(async () => {
      save.resolve(fixture("에이 본문!"));
    });
    await flush();

    expect(shownBody()).toBe("비 본문");
    expect(storedDraft("A")?.data.answers[0].cover_letter).toBe("에이 본문!");
  });

  // id 만 보는 가드로는 A→B→A 왕복이 안 잡힌다. 돌아오면 id 는 다시 같아지지만 그 사이
  // 재조회가 끼어들어 resultRef 는 **저장 전** 본문으로 되돌아가 있고, 그걸 이어 고친
  // 편집으로 오인해 쓰면 전환 때 남긴 올바른 draft 를 낡은 본문으로 덮는다.
  it("저장 도중 A→B→A 로 돌아와도 재조회한 저장 전 본문이 임시 저장을 덮지 않는다", async () => {
    const route = routeById();
    const save = deferred<CoverLetterResult>();
    mockUpdateCoverLetter.mockImplementation(() => save.promise);
    const result = await renderId("A");
    route.resolve("A", fixture("에이 본문"));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    await user.click(screen.getByRole("button", { name: "저장" }));

    // A→B→A. 떠나던 순간의 cleanup 이 A 의 편집을 A 의 키에 남긴다.
    await navigateTo(result, "B");
    route.resolve("B", fixture("비 본문"));
    await flush();
    await navigateTo(result, "A");
    // 두 번째 A 조회는 저장이 아직 안 끝나 **저장 전** 본문을 준다.
    route.resolve("A", fixture("에이 본문"), 1);
    await flush();

    await act(async () => {
      save.resolve(fixture("에이 본문!"));
    });
    await flush();

    expect(storedDraft("A")?.data.answers[0].cover_letter).toBe("에이 본문!");
    expect(screen.queryByRole("button", { name: "복원" })).toBeTruthy();
  });

  // 언마운트는 seq 를 올리지 않아 다시 들어온 새 인스턴스의 키(seq 0)와 겹친다. 그 틈으로
  // 늦게 끝난 옛 저장이 가드를 통과하면, 새 인스턴스가 복원하라고 띄워 둔 임시 저장을 지운다.
  it("언마운트 뒤 늦게 끝난 저장은 새 인스턴스가 띄운 임시 저장을 지우지 않는다", async () => {
    const route = routeById();
    const save = deferred<CoverLetterResult>();
    mockUpdateCoverLetter.mockImplementation(() => save.promise);
    const first = await renderId("A");
    route.resolve("A", fixture("에이 본문"));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    await user.click(screen.getByRole("button", { name: "저장" }));

    // 완전한 이탈 — 언마운트 cleanup 이 A 의 편집을 A 키에 남긴다.
    first.unmount();

    // 같은 문서로 다시 들어온다(새 인스턴스, seq 는 0 부터).
    await renderId("A");
    route.resolve("A", fixture("에이 본문"), 1);
    await flush();

    // 새 인스턴스는 그 임시 저장을 복원 후보로 띄운 상태다.
    expect(screen.getByRole("button", { name: "복원" })).toBeTruthy();
    expect(storedDraft("A")?.data.answers[0].cover_letter).toBe("에이 본문!");

    await act(async () => {
      save.resolve(fixture("에이 본문!"));
    });
    await flush();

    expect(storedDraft("A")?.data.answers[0].cover_letter).toBe("에이 본문!");
  });
});

/**
 * FRT-261 — '뒤로' 버튼은 저장 실패를 알리고 이동까지 막는데, GNB 링크·브라우저 뒤로가기로
 * 떠나는 경로가 기댈 안전망은 언마운트 cleanup 하나뿐이었다. 그 자리가 `writeDraft` 의
 * 결과를 버리고 있어, 저장이 실패해도 **아무 신호 없이** 편집이 사라졌다.
 *
 * 이 화면은 플래그가 꺼져 있어 브라우저로 열어볼 수 없다 — 이 테스트가 유일한 증거다.
 */
describe("이탈 경로에서 임시 저장이 위태로우면 사용자에게 알린다", () => {
  /** 웹 스토리지 쓰기를 통째로 막는다 — 프라이빗 모드·용량 초과가 이렇게 던진다. */
  function blockStorageWrites() {
    return vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage) {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      });
  }

  async function editThenLeaveBy(leave: (r: ReturnType<typeof render>) => void) {
    const route = routeById();
    const view = await renderId("A");
    route.resolve("A", fixture("에이 본문"));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    vi.mocked(toast.error).mockClear();
    return { view, leave: () => leave(view) };
  }

  it("언마운트 이탈에서 저장이 메모리로 밀리면 경고한다", async () => {
    const { leave } = await editThenLeaveBy((v) => v.unmount());
    const spy = blockStorageWrites();

    leave();
    spy.mockRestore();

    // 편집 자체는 살아 있다 — 다만 새로고침이면 잃는다는 사실을 사용자가 알아야 한다.
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("새로고침"));
  });

  it("정상 저장되는 이탈에서는 아무것도 경고하지 않는다", async () => {
    const { leave } = await editThenLeaveBy((v) => v.unmount());

    leave();

    expect(toast.error).not.toHaveBeenCalled();
  });

  // '뒤로' 버튼은 담긴 이상 붙잡지 않는다 — 이 환경에서는 아무리 눌러도 영구 저장이
  // 성공하지 않아, 막으면 출구 없는 화면이 된다.
  it("'뒤로' 버튼은 임시 계층에 담겼으면 경고하고 이동시킨다", async () => {
    const route = routeById();
    await renderId("A");
    route.resolve("A", fixture("에이 본문"));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    vi.mocked(toast.error).mockClear();
    mockPush.mockClear();

    const spy = blockStorageWrites();
    await user.click(screen.getByRole("button", { name: "익스포트" }));
    spy.mockRestore();

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("새로고침"));
    // 담기긴 했으므로 붙잡지 않는다 — 예전에는 여기서 이동이 막혔다.
    expect(mockPush).toHaveBeenCalled();
  });

  // '뒤로'는 스스로 이동을 일으켜 곧바로 언마운트로 이어진다. 두 자리가 각각 경고를
  // 띄우면 한 번의 이탈에 같은 문구가 두 번 뜬다 — 두 번째는 알려줄 새 사실이 없으면서
  // "또 실패했나" 하는 인상만 남긴다. 저장 자체는 양쪽 모두에서 계속 시도한다.
  it("'뒤로'가 이미 경고했으면 뒤따르는 언마운트는 같은 경고를 되풀이하지 않는다", async () => {
    const route = routeById();
    const view = await renderId("A");
    route.resolve("A", fixture("에이 본문"));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    vi.mocked(toast.error).mockClear();

    // 클릭과 뒤이은 언마운트가 **같은** 저장 실패 환경을 만나야 재현된다.
    const spy = blockStorageWrites();
    await user.click(screen.getByRole("button", { name: "익스포트" }));
    view.unmount();
    spy.mockRestore();

    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

/**
 * FRT-107 — `cover_letter_edited` 는 "AI 초안을 사람이 고쳐 썼는가"를 묻는다.
 *
 * 임시 저장 복원은 그 질문의 답이 아니다. 지난 세션의 편집을 되돌려 놓는 것이라 그 편집은
 * 이미 한 번 세어졌고, 이번 세션에서 사용자는 아무것도 치지 않았다. 그런데 복원은 result 만
 * 갈아끼워 initial(서버본)과 갈라놓으므로 dirty 가 서고, 계측이 그것을 방금 친 것으로 읽는다.
 * 레쥬메가 같은 자리에서 같은 이유로 표식을 미리 소비한다 — 자소서에만 그 처리가 빠져 있었다.
 */
describe("FRT-107 — 복원은 새 편집이 아니다", () => {
  /** 서버 created_at(2026-07-21)보다 뒤인 draft — 복원 배너가 뜬다. */
  function seedNewerDraft(id: string, body: string) {
    window.localStorage.setItem(
      `arc:cover-letter-draft:${id}`,
      JSON.stringify({
        data: fixture(body),
        updated_at: "2026-07-22T00:00:00Z",
      }),
    );
  }

  it("임시 저장을 복원해도 cover_letter_edited 를 쏘지 않는다", async () => {
    const route = routeById();
    seedNewerDraft("A", "지난 세션에 고친 본문");
    await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();

    // 배너가 실재하는 상태에서 출발했음을 먼저 못박는다 — 없으면 단언이 공허하게 통과한다.
    expect(screen.getByRole("button", { name: "복원" })).toBeTruthy();
    vi.mocked(capture).mockClear();

    await userEvent.setup().click(screen.getByRole("button", { name: "복원" }));
    await flush();

    const fired = vi.mocked(capture).mock.calls.map(([name]) => name);
    expect(fired).not.toContain("cover_letter_edited");
  });

  // 복원 직후 이어지는 편집도 첫 편집으로 다시 잡지 않는다. 이 이벤트는 "이 문서에 손댔다"를
  // 문서당 한 번 세는 것이고, 복원 배너가 떴다는 건 그 손댐이 **지난 세션에 이미 세어졌다**는
  // 뜻이다. 여기서 다시 쏘면 한 문서가 두 번 잡혀 "몇 개의 초안이 고쳐지는가"가 부풀어 오른다.
  // 레쥬메가 같은 이유로 표식을 소진한다 — 두 기능이 갈리면 나란히 못 놓는다.
  it("복원 뒤 이어지는 편집도 첫 편집으로 다시 세지 않는다", async () => {
    const route = routeById();
    seedNewerDraft("A", "지난 세션에 고친 본문");
    await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "복원" }));
    await flush();
    vi.mocked(capture).mockClear();

    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    await flush();

    const fired = vi.mocked(capture).mock.calls.map(([name]) => name);
    expect(fired).not.toContain("cover_letter_edited");
  });

  // 한 번의 저장 시도에는 결말이 하나여야 한다. 저장이 도는 중에 떠나면 그 요청이 곧
  // server/failed 를 쏘는데, 이탈 경로가 exit_draft 까지 쏘면 배타적인 두 결말이 실린다.
  // 게다가 exit_draft 는 "저장을 누르지 않고 떠났다"는 뜻이라 방금 누른 사용자에겐 거짓이다.
  it("저장이 도는 중에 떠나면 exit_draft 를 쏘지 않고 결말은 저장 쪽이 낸다", async () => {
    const route = routeById();
    const save = deferred<CoverLetterResult>();
    mockUpdateCoverLetter.mockImplementation(() => save.promise);
    const view = await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    await user.click(screen.getByRole("button", { name: "저장" }));
    vi.mocked(capture).mockClear();

    // 응답이 아직 안 온 채로 GNB 링크 등으로 떠난다.
    view.unmount();

    const outcomes = vi
      .mocked(capture)
      .mock.calls.filter(([name]) => name === "cover_letter_edit_saved")
      .map(([, props]) => (props as { outcome: string }).outcome);
    expect(outcomes).not.toContain("exit_draft");

    // 편집을 지키는 쪽은 그대로다 — 계측만 건너뛴다.
    expect(
      window.localStorage.getItem("arc:cover-letter-draft:A"),
    ).not.toBeNull();

    await act(async () => {
      save.resolve(fixture("서버 본문!"));
    });
    await flush();

    const settled = vi
      .mocked(capture)
      .mock.calls.filter(([name]) => name === "cover_letter_edit_saved")
      .map(([, props]) => (props as { outcome: string }).outcome);
    expect(settled).toEqual(["server"]);
  });

  // 반대쪽 못 — 배너가 없는 평범한 진입에서는 첫 편집이 그대로 잡혀야 한다. 이게 없으면
  // 위 두 단언은 "아무 때도 안 쏜다"로도 통과한다.
  it("복원 배너가 없는 진입에서는 첫 편집을 그대로 잡는다", async () => {
    const route = routeById();
    await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();
    vi.mocked(capture).mockClear();

    await userEvent.setup().type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    await flush();

    expect(capture).toHaveBeenCalledWith(
      "cover_letter_edited",
      expect.objectContaining({ cover_letter_id: "A" }),
    );
  });
});

/**
 * FRT-193 — "비어 있다"를 **편집 중인 본문**으로 판정하면, 마지막 글자를 지우는 순간
 * 편집기가 통째로 언마운트돼 그 화면에서 다시 쓸 방법이 사라진다(문항이 1개면 즉시).
 *
 * 그래서 두 가지를 함께 못 박는다. ① 판정 기준은 **서버가 만들어 준 원본**이다 —
 * 사용자가 지운 것은 "생성 결과가 부실하다"가 아니다. ② 안내는 편집기를 **치우는 대신
 * 그 위에 선다** — 배타 분기로 두는 한, 기준만 고쳐서는 빠져나올 수 없는 화면이 또 생긴다.
 */
/**
 * FRT-329 — 탭을 닫거나 새로고침하면 편집이 저장 없이 사라졌다.
 *
 * 임시 저장은 언마운트 cleanup 에서 일어나는데 진짜 페이지 언로드에서는 그 cleanup 이
 * 실행되지 않는다. beforeunload 는 경고만 띄울 뿐 아무것도 남기지 않았다.
 * 이제 pagehide 가 편집을 남기고, 탭이 숨겨질 때는 조용히 담아 두기만 한다.
 * 레쥬메 상세와 같은 훅을 쓰므로 단언도 대칭이다.
 */
describe("FRT-329 — 탭을 닫아도 편집이 남는다", () => {
  const DRAFT_KEY = "arc:cover-letter-draft:A";

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
  }
  function fireHidden(): void {
    setVisibility("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }
  function firePageHide(): void {
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
  }
  function editSavedCalls(): unknown[][] {
    return vi
      .mocked(capture)
      .mock.calls.filter(([name]) => name === "cover_letter_edit_saved");
  }

  async function renderEdited() {
    const route = routeById();
    const view = await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();
    await userEvent.setup().type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );
    vi.mocked(capture).mockClear();
    vi.mocked(toast.error).mockClear();
    return view;
  }

  afterEach(() => setVisibility("visible"));

  it("pagehide 에 편집을 임시 저장하고 exit_draft 를 언로드 전송으로 1회 남긴다", async () => {
    await renderEdited();

    firePageHide();

    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    // 배치 큐에 담으면 페이지와 함께 사라진다 — sendBeacon 경로를 고르는 옵션이 실려야 한다.
    expect(editSavedCalls()).toEqual([
      [
        "cover_letter_edit_saved",
        {
          outcome: "exit_draft",
          persisted: true,
          storage_tier: "local",
          question_count: 1,
        },
        { atUnload: true },
      ],
    ]);
  });

  it("편집이 없으면 pagehide 에 아무것도 남기지 않는다", async () => {
    const route = routeById();
    await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();
    vi.mocked(capture).mockClear();

    firePageHide();

    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(editSavedCalls()).toEqual([]);
  });

  // 탭 전환은 이탈이 아니다 — 돌아와서 계속 쓴다. 다만 모바일은 이 뒤에 pagehide 없이
  // 탭을 죽이는 일이 잦아 편집만 먼저 담아 둔다. 지표는 쏘지 않는다.
  it("탭이 숨겨지면 조용히 임시 저장만 하고 지표는 쏘지 않는다", async () => {
    await renderEdited();

    fireHidden();

    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(editSavedCalls()).toEqual([]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  // 볼 사람이 없는 화면에 경고를 띄우지 않는다. 실패는 persisted:false 로 지표에만 남는다.
  it("pagehide 저장이 웹 스토리지에 못 담겨도 토스트는 띄우지 않는다", async () => {
    await renderEdited();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage) {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      });
    try {
      firePageHide();
    } finally {
      setItem.mockRestore();
    }

    expect(toast.error).not.toHaveBeenCalled();
    expect(editSavedCalls().map(([, p]) => p)).toEqual([
      expect.objectContaining({ outcome: "exit_draft", storage_tier: "memory" }),
    ]);
  });

  // 중복 발화 가드와의 상호작용 — 한 이탈은 한 번만 센다.
  it("pagehide 뒤에 언마운트가 이어져도 exit_draft 는 한 번이다", async () => {
    const view = await renderEdited();

    firePageHide();
    view.unmount();

    expect(editSavedCalls()).toHaveLength(1);
  });

  it("'뒤로'가 이미 센 이탈은 pagehide 가 다시 세지 않는다", async () => {
    await renderEdited();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "익스포트" }));
    firePageHide();

    expect(editSavedCalls()).toHaveLength(1);
  });

  // 저장이 도는 중이면 그 요청이 곧 server/failed 로 결말을 낸다 — 한 시도에 결말 하나.
  it("저장이 도는 중에 탭을 닫으면 편집은 남기되 exit_draft 는 쏘지 않는다", async () => {
    const save = deferred<CoverLetterResult>();
    mockUpdateCoverLetter.mockImplementation(() => save.promise);
    await renderEdited();
    await userEvent.setup().click(screen.getByRole("button", { name: "저장" }));
    vi.mocked(capture).mockClear();

    firePageHide();

    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(editSavedCalls()).toEqual([]);
  });

  // 반대쪽 못 — 저장에 성공해 dirty 가 풀리면 pagehide 는 손대지 않는다. 이게 없으면
  // "저장했는데 다음 진입에 복원 배너가 뜬다"(FRT-191)가 탭 닫기 경로로 되살아난다.
  it("저장에 성공한 뒤 pagehide 는 draft 를 다시 만들지 않는다", async () => {
    mockUpdateCoverLetter.mockImplementation(async () => fixture("서버 본문!"));
    await renderEdited();
    await userEvent.setup().click(screen.getByRole("button", { name: "저장" }));
    await flush();
    expect(editSavedCalls().map(([, p]) => p)).toEqual([
      expect.objectContaining({ outcome: "server" }),
    ]);

    firePageHide();

    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(editSavedCalls()).toHaveLength(1);
  });

  // 다른 문서로 옮기는 창(loading)에서는 id 는 이미 B 인데 result/dirty 는 아직 A 것이다
  // (FRT-238). 여기서 담으면 A 의 편집이 B 의 키로 들어가 B 가 남의 내용을 복원하라고
  // 권한다. A 의 편집은 문서가 바뀌는 순간 언마운트 cleanup 이 A 키로 이미 남겼다.
  it("다른 문서로 옮기는 중에는 옛 문서 편집을 새 문서 키로 담지 않는다", async () => {
    const route = routeById();
    const view = await renderId("A");
    route.resolve("A", fixture("서버 본문"));
    await flush();
    await userEvent.setup().type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "!",
    );

    await navigateTo(view, "B");
    expect(loadingShown()).toBe(true);
    fireHidden();
    firePageHide();

    expect(window.localStorage.getItem("arc:cover-letter-draft:B")).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  // 숨겨질 때 담아 둔 편집을 돌아와서 되돌리면 화면은 깨끗한데 저장소에는 스냅샷이 남아,
  // 다음 진입에 버린 편집을 복원하라고 권하게 된다 — 담은 쪽이 치운다.
  it("숨겨질 때 담아 둔 편집을 되돌려 깨끗해지면 그 스냅샷도 지운다", async () => {
    await renderEdited();
    fireHidden();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    setVisibility("visible");
    await userEvent.setup().type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "{Backspace}",
    );

    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  // 같은 문서를 두 탭에서 열면 탭을 오갈 때마다 hidden 이 온다. 손대지 않은 탭이 같은
  // 내용을 더 새 시각으로 다시 쓰면 다른 탭이 방금 남긴 편집을 덮는다.
  it("손대지 않은 채 다시 숨겨지면 같은 편집을 다시 쓰지 않는다", async () => {
    await renderEdited();
    fireHidden();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    // 다른 탭이 더 새 편집을 남긴 상황.
    window.localStorage.setItem(DRAFT_KEY, "other-tab");
    setVisibility("visible");
    fireHidden();

    expect(window.localStorage.getItem(DRAFT_KEY)).toBe("other-tab");
  });
});

describe("FRT-193 — 본문을 전부 지워도 편집을 이어갈 수 있다", () => {
  it("문항 1개짜리에서 본문을 전부 지워도 편집기가 남아 계속 입력된다", async () => {
    const route = routeById();
    await renderId("A");
    route.resolve("A", fixture("원래 본문"));
    await flush();

    const user = userEvent.setup();
    await user.clear(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
    );

    // 예전에는 여기서 편집기가 사라져 null 이었다 — 페이지를 나갔다 와야 복구됐다.
    expect(shownBody()).toBe("");

    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "다시 쓴다",
    );
    expect(shownBody()).toBe("다시 쓴다");
  });

  it("사용자가 지운 것뿐이면 생성 결과 안내를 띄우지 않는다", async () => {
    const route = routeById();
    await renderId("A");
    route.resolve("A", fixture("원래 본문"));
    await flush();

    const user = userEvent.setup();
    await user.clear(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
    );

    expect(screen.queryByText("본문이 비어 있어요.")).toBeNull();
  });

  it("생성 결과가 비어 있으면 안내와 편집기를 함께 보여준다", async () => {
    const route = routeById();
    await renderId("A");
    route.resolve("A", fixture(""));
    await flush();

    expect(screen.queryByText("본문이 비어 있어요.")).not.toBeNull();
    // 안내만 띄우고 끝내면 사용자가 그 자리에서 직접 쓸 길이 없다.
    expect(shownBody()).toBe("");
  });

  it("비어 있던 자소서에 직접 써 넣으면 안내가 물러난다", async () => {
    const route = routeById();
    await renderId("A");
    route.resolve("A", fixture(""));
    await flush();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "문항 1 자기소개서 본문" }),
      "직접 쓴 본문",
    );

    expect(shownBody()).toBe("직접 쓴 본문");
    expect(screen.queryByText("본문이 비어 있어요.")).toBeNull();
  });

  it("문항이 하나도 없으면 편집기 없이 안내만 보여준다", async () => {
    const route = routeById();
    await renderId("A");
    route.resolve("A", { ...fixture(""), answers: [] });
    await flush();

    expect(screen.queryByText("본문이 비어 있어요.")).not.toBeNull();
    expect(shownBody()).toBeNull();
  });
});
