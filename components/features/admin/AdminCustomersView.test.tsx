import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// next/navigation 과 API 를 격리한다. searchParams 는 가변 홀더로 두고 rerender 로 외부 URL 변화를
// 흉내낸다(Back/Forward). replace/push 는 스파이.
const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => nav.params,
}));

// 쿼리별로 다른 응답을 주도록 조작 가능한 스텁(초과 페이지 정규화 레이스 재현에 필요).
type CustomersResult = { count: number; contents: unknown[] };

const api = vi.hoisted(() => ({
  getAdminCustomers:
    vi.fn<(args?: { q?: string }) => Promise<CustomersResult>>(),
}));

vi.mock("@/lib/api/admin-api", () => ({
  getAdminCustomers: api.getAdminCustomers,
}));

import { AdminCustomersView } from "./AdminCustomersView";

function searchbox() {
  return screen.getByRole("searchbox", {
    name: "이메일 또는 이름으로 고객 검색",
  });
}

async function flush() {
  // 디바운스 타이머 경과 + 마운트 fetch 프로미스 소진.
  await act(async () => {
    vi.advanceTimersByTime(300);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  nav.replace.mockClear();
  nav.push.mockClear();
  nav.params = new URLSearchParams();
  api.getAdminCustomers.mockReset();
  api.getAdminCustomers.mockImplementation(async () => ({
    count: 0,
    contents: [],
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AdminCustomersView — 검색어 URL 반영", () => {
  it("입력이 디바운스되면 ?q= 로 URL 을 갱신한다(1페이지 리셋)", async () => {
    render(<AdminCustomersView />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(searchbox(), { target: { value: "kim" } });
    await flush();

    expect(nav.replace).toHaveBeenCalledWith("/admin/customers?q=kim", {
      scroll: false,
    });
  });
});

describe("AdminCustomersView — 초과 페이지 정규화", () => {
  it("직전 쿼리의 낡은 count 로 유효한 페이지를 깎지 않는다", async () => {
    // ?q=희귀&page=1(1건) → ?page=20(1000건) 으로 Back/Forward.
    // 훅이 자기 effect 안에서 setIsLoading(true) 하므로, 같은 패스의 정규화 effect 는 아직
    // 직전 쿼리의 isLoading=false·count=1 을 본다. 그걸로 깎으면 멀쩡한 20페이지가 1페이지로
    // 되돌아간다(Codex adversarial).
    api.getAdminCustomers.mockImplementation(async (args) =>
      args?.q
        ? { count: 1, contents: [{ id: "c1" }] }
        : { count: 1000, contents: [{ id: "c2" }] },
    );

    nav.params = new URLSearchParams("q=rare");
    const { rerender } = render(<AdminCustomersView />);
    await flush();

    nav.replace.mockClear();

    // 외부에서 검색어가 사라지고 20페이지로 이동.
    nav.params = new URLSearchParams("page=20");
    rerender(<AdminCustomersView />);
    await flush();

    // 1000건이면 20페이지는 유효 범위 — 어떤 되돌림도 없어야 한다.
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("정규화가 입력 중인 검색어를 지우지 않는다", async () => {
    // `?q=foo&page=99` 딥링크가 로딩되는 동안 사용자가 타이핑하면, 응답이 와서 페이지를 깎는
    // 순간 URL 동기화가 입력창을 옛 검색어로 되돌려 타이핑이 조용히 사라진다(Codex P2).
    api.getAdminCustomers.mockImplementation(async () => ({
      count: 25,
      contents: [{ id: "c1" }],
    }));

    // 정규화가 정말 주소를 바꾸도록 스파이를 실제 URL 갱신에 연결한다 — 그래야 그 뒤의 입력창
    // 동기화까지 재현된다(스파이만 두면 URL 이 안 바뀌어 버그가 드러나지 않는다).
    nav.replace.mockImplementation((href: string) => {
      nav.params = new URLSearchParams(href.split("?")[1] ?? "");
    });

    nav.params = new URLSearchParams("q=foo&page=99");
    const { rerender } = render(<AdminCustomersView />);
    // 응답이 오기 전(=정규화 전)에 타이핑.
    fireEvent.change(searchbox(), { target: { value: "bar" } });
    await flush();

    // 정규화가 일어났다면 그 결과 URL 로 다시 렌더된다.
    rerender(<AdminCustomersView />);

    expect(searchbox()).toHaveValue("bar");
  });

  it("실제로 범위를 벗어난 페이지는 마지막 유효 페이지로 정규화한다", async () => {
    api.getAdminCustomers.mockImplementation(async () => ({
      count: 25,
      contents: [{ id: "c1" }],
    }));

    nav.params = new URLSearchParams("page=99");
    render(<AdminCustomersView />);
    await flush();

    // 25건 / 20 = 2페이지.
    expect(nav.replace).toHaveBeenCalledWith("/admin/customers?page=2", {
      scroll: false,
    });
  });
});

describe("AdminCustomersView — 외부 URL 변화(Back/Forward)", () => {
  it("history 로 검색어가 바뀌어도 낡은 입력으로 URL 을 되돌리지 않는다", async () => {
    nav.params = new URLSearchParams("q=foo");
    const { rerender } = render(<AdminCustomersView />);
    await act(async () => {
      await Promise.resolve();
    });
    nav.replace.mockClear();

    // 뒤로가기: 외부에서 qParam 이 bar 로 바뀐 상태로 재렌더.
    nav.params = new URLSearchParams("q=bar");
    rerender(<AdminCustomersView />);
    await flush();

    // 입력창은 새 URL 값을 따라가고, URL 을 foo 로 되돌리는 write 는 없어야 한다.
    expect(searchbox()).toHaveValue("bar");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("검색어는 그대로고 페이지만 바뀌는 history 이동도 미확정 입력을 되돌리지 않는다", async () => {
    // `?q=foo&page=2` → `?q=foo` 처럼 q 가 안 바뀌는 이동. 디바운스(300ms)가 끝나기 전에 뒤로
    // 가면 입력창에 남은 미확정 값이 그 뒤 URL 을 덮어써 방금의 이동을 무효로 만든다(Codex P2).
    api.getAdminCustomers.mockImplementation(async () => ({
      count: 1000,
      contents: [{ id: "c1" }],
    }));

    nav.params = new URLSearchParams("q=foo&page=2");
    const { rerender } = render(<AdminCustomersView />);
    await flush();
    nav.replace.mockClear();

    // 디바운스가 끝나기 전에 타이핑만 해 둔다(아직 URL 에 안 실린 상태).
    fireEvent.change(searchbox(), { target: { value: "bar" } });

    // 뒤로가기: q 는 foo 그대로, page 만 사라진다.
    nav.params = new URLSearchParams("q=foo");
    rerender(<AdminCustomersView />);
    await flush();

    expect(searchbox()).toHaveValue("foo");
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
