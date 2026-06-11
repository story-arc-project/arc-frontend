"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { FIRST_ONBOARDING_STEP } from "@/app/(auth)/constants";

/**
 * 보호 영역(/(main)) 진입 가드.
 *
 * 인증 상태가 확정되기 전까지 보호 콘텐츠를 가리고, 확정된 뒤 분기한다:
 * - 비인증(정상 401)          → /login?callbackUrl=<현재 경로>
 * - 인증됐으나 온보딩 미완료   → /signup?step=consent
 * - 인증 + 온보딩 완료        → children 통과
 *
 * /auth/me가 네트워크·5xx로 실패하면(error≠null) 비인증으로 단정하지 않고 재시도 화면을 보여준다.
 * (일시 장애를 /login으로 튕기면 유효 세션 사용자를 로그아웃시키는 셈이 된다. FRT-12 보존.)
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, error, isLoading, isOnboarded, refetch } = useAuth();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  // 인증/온보딩 가드는 로딩·조회실패가 아닌 '확정된' 상태에서만 판단한다.
  const settled = !isLoading && error === null && !retrying;
  const redirect = settled
    ? user === null
      ? "login"
      : !isOnboarded
        ? "onboard"
        : null
    : null;

  useEffect(() => {
    if (redirect === "login") {
      // callbackUrl은 effect(클라이언트 전용)에서 window.location으로 읽는다.
      // usePathname()은 쿼리스트링을 버려 /archive?id=… 같은 딥링크 복귀를 깨뜨린다.
      const from = window.location.pathname + window.location.search;
      router.replace(`/login?callbackUrl=${encodeURIComponent(from)}`);
    } else if (redirect === "onboard") {
      router.replace(`/signup?step=${FIRST_ONBOARDING_STEP}`);
    }
  }, [redirect, router]);

  if (user === null && (error !== null || retrying)) {
    // 재시도 중에는 refetch가 error를 잠시 비워도 보호 페이지가 깜빡이지 않도록 화면을 유지한다.
    const handleRetry = () => {
      setRetrying(true);
      void refetch().finally(() => setRetrying(false));
    };

    return (
      <main className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <div
            role="alert"
            aria-live="polite"
            className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center text-center"
          >
            <p className="text-body text-text-secondary mb-3">
              로그인 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 rounded-md bg-brand text-text-on-brand text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {retrying ? "다시 시도 중..." : "다시 시도"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 로딩 중 또는 리다이렉트 대기 중 → 보호 콘텐츠/빈 사용자 UI 노출 없이 로딩 화면 유지(깜빡임 방지).
  if ((user === null && isLoading) || redirect !== null) {
    return (
      <main
        className="min-h-[calc(100dvh-var(--gnb-h))] flex items-center justify-center px-4"
        aria-busy="true"
      >
        <p className="text-body text-text-tertiary">불러오는 중...</p>
      </main>
    );
  }

  return <>{children}</>;
}
