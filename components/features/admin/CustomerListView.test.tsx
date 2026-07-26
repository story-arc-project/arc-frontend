import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { CustomerListView } from "./CustomerListView";
import type { AdminCustomer } from "@/types/admin";

const customers: AdminCustomer[] = [
  {
    id: "c1",
    email: "jiwoo@example.com",
    name: "김지우",
    status: "active",
    onboarded: true,
    createdAt: "2026-06-14T02:11:00Z",
  },
  {
    id: "",
    email: "broken@example.com",
    name: null,
    status: "dormant",
    onboarded: false,
    createdAt: "2026-05-02T09:30:00Z",
  },
];

function renderList(override: Partial<Parameters<typeof CustomerListView>[0]> = {}) {
  return render(
    <CustomerListView
      customers={customers}
      isLoading={false}
      error={null}
      onRetry={() => {}}
      query=""
      {...override}
    />,
  );
}

// globals:false 라 자동 cleanup 이 없다(.claude/rules/testing.md).
afterEach(() => {
  cleanup();
});

describe("CustomerListView — 가입일 표기", () => {
  it("자정 근처 가입일을 실행 환경 타임존과 무관하게 한국 날짜로 렌더한다", () => {
    // UTC 로 읽으면 7/25, 한국시간으로는 7/26 인 시각. 타임존을 안 고정하면 서버(UTC)와
    // 브라우저(KST)가 다른 날짜를 그려 하이드레이션 불일치가 난다(Codex P2).
    renderList({
      customers: [
        {
          id: "c9",
          email: "edge@example.com",
          name: "경계",
          status: "active",
          onboarded: true,
          createdAt: "2026-07-25T15:30:00Z",
        },
      ],
    });

    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText(/2026\.\s*07\.\s*26/)).toBeTruthy();
  });
});

describe("CustomerListView — 표 시맨틱", () => {
  it("열 관계를 읽을 수 있는 table 로 렌더한다", () => {
    renderList();

    // div 그리드 + role="row" 만으로는 스크린리더가 값을 어느 열의 것인지 못 읽는다(Codex P2).
    expect(screen.getByRole("table", { name: "가입 고객 목록" })).toBeTruthy();

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["이메일", "이름", "상태", "온보딩", "가입일"]);
  });

  it("고객 1건이 셀 5개를 가진 행 1줄이 된다", () => {
    renderList();

    // 헤더 1줄 + 고객 2줄.
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);

    const firstCustomerRow = rows[1];
    expect(within(firstCustomerRow).getAllByRole("cell")).toHaveLength(5);
  });

  it("id 가 있는 고객만 상세 링크를 가진다", () => {
    renderList();

    // 정상 행: 이메일이 실제 링크(키보드·스크린리더 경로).
    const link = screen.getByRole("link", { name: "jiwoo@example.com" });
    expect(link.getAttribute("href")).toBe("/admin/customers/c1");

    // 빈 id 행: `/admin/customers/` 로 붕괴하는 링크를 만들지 않는다.
    expect(screen.queryByRole("link", { name: "broken@example.com" })).toBeNull();
  });
});

describe("CustomerListView — 상태별 렌더", () => {
  it("빈 결과는 검색어를 되짚어 안내한다", () => {
    renderList({ customers: [], query: "zzz" });
    expect(screen.getByText('"zzz"에 해당하는 고객이 없어요.')).toBeTruthy();
  });

  it("에러는 alert 로 알리고 다시 시도를 준다", () => {
    renderList({ customers: [], error: new Error("boom") });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });
});
