"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";

import type { AuthUser, AuthContextValue } from "@/types/auth";
import { fetchCurrentUser, logoutUser } from "@/lib/api/auth-api";
import { identifyUser, isIdentified, resetUser } from "@/lib/analytics";

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
  // 같은 사용자를 매 /auth/me 마다 다시 해시·identify 하지 않도록 이메일을 기억한다.
  const identifiedEmailRef = useRef<string | null>(null);

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
      // 분석 세션도 익명으로 되돌려 다음 사용자와 섞이지 않게 한다(FRT-19).
      resetUser();
      // 1회성 마커(첫 기록·가입 완료)는 사용자별 키라 비우지 않는다 — 같은 기기의 다른
      // 사용자는 자기 키로 정상 발화하고, 같은 사람의 재로그인은 계속 막혀야 한다.
      identifiedEmailRef.current = null;
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

  // bfcache 에서 되살아나면(pageshow.persisted) 사용자 상태를 다시 읽는다.
  // 온보딩 완료·로그인은 하드 내비게이션으로 떠나므로 /signup·/login 문서가 bfcache 에
  // 통째로 남는다. 뒤로가기로 되살아난 문서는 마운트가 아니라서 위 최초 조회가 다시 돌지 않고,
  // 옛 user(onboarded=false)로 가드(useRedirectIfAuthenticated·AuthGate)가 침묵한다 →
  // 온보딩을 마친 사용자에게 온보딩 화면이 다시 보인다. 재조회가 user 를 갱신하면 가드가
  // 평소처럼 /dashboard 로 돌려보낸다.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refetch();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [refetch]);

  // 사용자가 확인되면(최초 로그인·재방문 모두) 해시된 이메일로 분석 식별한다(FRT-19).
  // 원본 이메일은 전송하지 않으며, 이후 퍼널 이벤트가 이 person 에 연결된다.
  useEffect(() => {
    // /auth/me 판정 전(초기 로드·재조회 중)에는 건드리지 않는다 — 인증된 사용자를
    // 잠시 익명으로 되돌렸다가 다시 식별하는 왕복을 막는다.
    if (isLoading) return;
    const email = user?.account.email;
    if (email) {
      if (identifiedEmailRef.current !== email) {
        identifiedEmailRef.current = email;
        void identifyUser(email);
      }
    } else if (identifiedEmailRef.current !== null || isIdentified()) {
      // 사용자 없음이 확정됨(세션 만료·소프트 로그아웃) → 익명으로 되돌려 이전 사용자에
      // 오귀속되지 않게. ref 뿐 아니라 isIdentified() 도 보는 이유: 쿠키가 앱 밖에서
      // 만료·삭제된 뒤 첫 로드는 ref 가 null 로 시작하므로, ref 만으로는 localStorage 에
      // 남은 이전 distinct_id 를 못 지운다 → 이후 가입/익명 이벤트가 그 사람에게 붙는다.
      identifiedEmailRef.current = null;
      resetUser();
    }
  }, [user, isLoading]);

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
