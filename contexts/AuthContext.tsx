"use client";

import { createContext, useCallback, useEffect, useState } from "react";

import type { AuthUser, AuthContextValue } from "@/types/auth";
import { fetchCurrentUser, logoutUser } from "@/lib/api/auth-api";

export const AuthContext = createContext<AuthContextValue | null>(null);

// 초기 /auth/me 조회가 일시적 장애(네트워크·5xx)로 실패하면 1회 자동 재시도한다.
const INITIAL_LOAD_RETRY_DELAY_MS = 800;

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCurrentUser();
      setUser(data);
    } catch (err) {
      // 일시 장애(네트워크·5xx)로 재조회가 실패해도 기존 user 를 비우지 않는다.
      // (프로필 저장 직후 동기화 refetch 가 실패해도 이미 인증된 사용자를 로그아웃/에러 화면으로
      //  내몰지 않기 위함 — 다음 정상 조회에서 갱신된다. 최초 로드는 아래 load() 가 별도 처리.)
      setError(err instanceof Error ? err : new Error("사용자 정보를 불러오지 못했어요."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      // 서버에서 httpOnly 쿠키가 실제로 제거된 뒤에만 상태 정리 + 이동한다.
      setUser(null);
      window.location.assign("/login");
    } catch (err) {
      // 로그아웃 실패 시 세션이 살아있으므로 이동하지 않고 실패를 노출한다.
      // (이동하면 /login에서 유효 세션을 재조회해 다시 앱으로 돌려보내 로그아웃이 무력화된다.)
      setError(err instanceof Error ? err : new Error("로그아웃에 실패했어요. 잠시 후 다시 시도해주세요."));
    }
  }, []);

  // 최초 마운트 시 자동 조회. 마지막 시도까지 실패한 뒤에만 error를 노출해
  // 재시도 사이에 오류 화면이 깜빡이지 않도록 한다. (refetch와 달리 1회 재시도 포함)
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async (retriesLeft: number) => {
      try {
        const data = await fetchCurrentUser();
        if (cancelled) return;
        setUser(data);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (retriesLeft > 0) {
          // isLoading 유지 + error 미설정 → 재시도까지 로딩 상태로 대기한다.
          retryTimer = setTimeout(() => load(retriesLeft - 1), INITIAL_LOAD_RETRY_DELAY_MS);
          return;
        }
        setUser(null);
        setError(err instanceof Error ? err : new Error("사용자 정보를 불러오지 못했어요."));
        setIsLoading(false);
      }
    };

    void load(1);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    isOnboarded: user?.onboarded ?? false,
    error,
    refetch,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
