import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const getMock = vi.fn();
vi.mock("@/lib/api/admin-api", () => ({
  getAdminCustomer: (...args: unknown[]) => getMock(...args),
}));

import { ApiError } from "@/lib/api/api-error";
import { AdminCustomerDetailView } from "./AdminCustomerDetailView";
import type { AdminCustomerDetail } from "@/types/admin";

const detail: AdminCustomerDetail = {
  customer: {
    id: "c1",
    email: "jiwoo@example.com",
    name: "김지우",
    status: "verified",
    onboarded: true,
    createdAt: "2026-03-14T02:11:00Z",
    withdrawnAt: null,
    authProviders: ["google"],
  },
  profile: {
    school: "○○대학교",
    department: "경영학과",
    affiliation: "대학생",
    affiliationDetail: null,
    company: null,
    desiredRole: "프로덕트 매니저",
  },
  activity: {
    experiences: { total: 12, lastAt: "2026-07-21T04:00:00Z", byStatus: null },
    individualAnalyses: {
      total: 8,
      lastAt: null,
      byStatus: { success: 7, failed: 1 },
    },
    comprehensiveAnalyses: null,
    keywordAnalyses: null,
    resumes: { total: 0, lastAt: null, byStatus: {} },
  },
};

// globals:false 라 자동 cleanup 이 없다(.claude/rules/testing.md).
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminCustomerDetailView — 조회 성공", () => {
  it("고객 id 로 상세를 조회해 계정·프로필·활동을 보여준다", async () => {
    getMock.mockResolvedValue(detail);
    render(<AdminCustomerDetailView id="c1" />);

    expect(await screen.findByText("김지우")).toBeTruthy();
    expect(getMock).toHaveBeenCalledWith("c1");
    expect(screen.getAllByText("jiwoo@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("경영학과")).toBeTruthy();
    expect(screen.getByText("12건")).toBeTruthy();
    expect(screen.getByText("성공 7 · 실패 1")).toBeTruthy();
  });

  it("활동 0건은 0 으로, 미상은 —로 구분해 보여준다", async () => {
    getMock.mockResolvedValue(detail);
    render(<AdminCustomerDetailView id="c1" />);
    await screen.findByText("김지우");

    // resumes: total 0 → "0건", comprehensiveAnalyses/keywordAnalyses: null → "—"
    expect(screen.getByText("0건")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("계약에서 제외한 PII 는 화면에 나타나지 않는다", async () => {
    getMock.mockResolvedValue(detail);
    render(<AdminCustomerDetailView id="c1" />);
    await screen.findByText("김지우");

    expect(screen.queryByText(/전화/)).toBeNull();
    expect(screen.queryByText(/생년월일/)).toBeNull();
  });
});

describe("AdminCustomerDetailView — 없는 고객(404)", () => {
  it("404 는 재시도 없이 '찾을 수 없는 고객'으로 안내한다", async () => {
    // 존재하지 않는다는 건 확정된 사실이라 재시도는 영원히 실패할 요청을 반복하게 만든다.
    getMock.mockRejectedValue(new ApiError(404, "Customer not found"));
    render(<AdminCustomerDetailView id="ghost" />);

    expect(await screen.findByText("찾을 수 없는 고객이에요.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(screen.getByRole("link", { name: "고객 목록으로" })).toBeTruthy();
  });

  it("id 가 비면 요청조차 하지 않고 없는 고객으로 다룬다", async () => {
    render(<AdminCustomerDetailView id="" />);

    expect(await screen.findByText("찾을 수 없는 고객이에요.")).toBeTruthy();
    expect(getMock).not.toHaveBeenCalled();
  });
});

describe("AdminCustomerDetailView — 실패", () => {
  it("서버 오류는 재시도 버튼과 함께 안내한다", async () => {
    getMock.mockRejectedValue(new ApiError(500, "boom"));
    render(<AdminCustomerDetailView id="c1" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("고객 정보를 불러오지 못했어요.");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  it("다시 시도를 누르면 재조회한다", async () => {
    const user = userEvent.setup();
    getMock.mockRejectedValueOnce(new ApiError(500, "boom"));
    getMock.mockResolvedValueOnce(detail);

    render(<AdminCustomerDetailView id="c1" />);
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("김지우")).toBeTruthy();
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("응답 형태가 깨져 매퍼가 실패해도 빈 화면 대신 에러를 보여준다", async () => {
    getMock.mockRejectedValue(new Error("고객 정보를 확인할 수 없어요."));
    render(<AdminCustomerDetailView id="c1" />);

    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

describe("AdminCustomerDetailView — stale 응답", () => {
  it("id 가 바뀌면 늦게 온 이전 응답이 현재 화면을 덮어쓰지 않는다", async () => {
    // 목록에서 연달아 다른 행으로 들어가면 이전 고객의 응답이 뒤늦게 도착할 수 있다.
    const first: { resolve?: (v: AdminCustomerDetail) => void } = {};
    getMock.mockImplementationOnce(
      () =>
        new Promise<AdminCustomerDetail>((resolve) => {
          first.resolve = resolve;
        }),
    );
    const second: AdminCustomerDetail = {
      ...detail,
      customer: { ...detail.customer, id: "c2", name: "이민호" },
    };
    getMock.mockResolvedValueOnce(second);

    const { rerender } = render(<AdminCustomerDetailView id="c1" />);
    rerender(<AdminCustomerDetailView id="c2" />);

    expect(await screen.findByText("이민호")).toBeTruthy();

    // 이제서야 첫 요청이 도착한다 — 무시되어야 한다.
    first.resolve?.(detail);
    await waitFor(() => {
      expect(screen.getByText("이민호")).toBeTruthy();
    });
    expect(screen.queryByText("김지우")).toBeNull();
  });
});
