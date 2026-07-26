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
});
