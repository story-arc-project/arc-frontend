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

vi.mock("@/lib/api/admin-api", () => ({
  getAdminCustomers: vi.fn(async () => ({ count: 0, contents: [] })),
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
