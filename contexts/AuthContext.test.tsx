import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useContext, type ReactNode } from "react";

import type { AuthUser } from "@/types/auth";
import AuthProvider, { AuthContext } from "@/contexts/AuthContext";

vi.mock("@/lib/api/auth-api", () => ({
  fetchCurrentUser: vi.fn(),
  logoutUser: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({
  identifyUser: vi.fn(async () => {}),
  isIdentified: vi.fn(() => false),
  resetUser: vi.fn(),
}));

import { fetchCurrentUser } from "@/lib/api/auth-api";

const mockFetch = vi.mocked(fetchCurrentUser);

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeUser(onboarded: boolean): AuthUser {
  return {
    account: { email: "u@example.com" },
    onboarded,
  } as unknown as AuthUser;
}

function firePageShow(persisted: boolean): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted }));
  });
}

function renderAuth() {
  const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
  return renderHook(() => useContext(AuthContext), { wrapper });
}

describe("AuthProvider — bfcache 에서 되살아나면 사용자 상태를 다시 읽는다", () => {
  it("pageshow.persisted 면 /auth/me 를 다시 불러 isOnboarded 가 갱신된다", async () => {
    // 온보딩 중 화면이 bfcache 로 들어갔다가(그 사이 온보딩 완료) 뒤로가기로 되살아난 상황.
    mockFetch.mockResolvedValueOnce(makeUser(false)).mockResolvedValueOnce(makeUser(true));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current?.isLoading).toBe(false));
    expect(result.current?.isOnboarded).toBe(false);

    firePageShow(true);

    await waitFor(() => expect(result.current?.isOnboarded).toBe(true));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("일반 로드의 pageshow(persisted=false) 는 다시 부르지 않는다", async () => {
    mockFetch.mockResolvedValue(makeUser(true));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current?.isLoading).toBe(false));

    firePageShow(false);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("언마운트 뒤의 pageshow 는 무시한다", async () => {
    mockFetch.mockResolvedValue(makeUser(true));
    const { result, unmount } = renderAuth();
    await waitFor(() => expect(result.current?.isLoading).toBe(false));
    unmount();

    firePageShow(true);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
