"use client";

import { createContext, useCallback, useEffect, useState } from "react";

import type { AuthUser, AuthContextValue } from "@/types/auth";
import { fetchCurrentUser, logoutUser } from "@/lib/api/auth-api";

export const AuthContext = createContext<AuthContextValue | null>(null);

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
      setError(err instanceof Error ? err : new Error("사용자 정보를 불러오지 못했어요."));
      setUser(null);
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

  useEffect(() => {
    refetch();
  }, [refetch]);

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
