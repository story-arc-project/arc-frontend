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

import { writeDraft } from "@/lib/export/cover-letter-draft";
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

  // 저장이 도는 동안 이어 고치면 clearDraft 가 건너뛰어져 낡은 draft 가 저장소에 남는다 —
  // 탭을 그냥 닫으면 다음 진입 때 그것이 배너로 되살아나 방금 저장한 내용을 되돌린다.
  it("저장 중에 이어 고치면 옛 draft 가 아니라 그 최신본이 임시 저장에 남는다", async () => {
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
    const draft = storedDraft("A");
    expect(draft?.data.answers[0].cover_letter).toBe("서버 본문!?");
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

  // 저장 중 고쳤다가 되돌리면 객체는 새것이지만 내용은 방금 보낸 것과 같다. 식별자로만
  // 가르면 새 draft 가 남아, 되돌릴 게 없는데 다음 진입에서 배너가 다시 뜬다.
  it("저장 중 고쳤다가 되돌리면 임시 저장을 새로 남기지 않는다", async () => {
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

    // 요청이 도는 동안 고쳤다가 그대로 되돌린다.
    await user.type(box, "?{Backspace}");

    await act(async () => {
      save.resolve(fixture("서버 본문!"));
    });
    await flush();

    expect(screen.queryByRole("button", { name: "복원" })).toBeNull();
    expect(storedDraft("A")).toBeNull();
  });
});
