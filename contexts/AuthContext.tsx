"use client";

import { createContext, useCallback, useEffect, useState } from "react";

import type { AuthUser, AuthContextValue } from "@/types/auth";
import { fetchCurrentUser, logoutUser } from "@/lib/auth-api";

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
    } finally {
      setUser(null);
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
