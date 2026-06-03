"use client";

import { useState } from "react";

import { useAuth } from "@/hooks/useAuth";

/**
 * 보호 영역(/(main)) 진입 시 인증 상태가 확정될 때까지 보호 콘텐츠를 가린다.
 *
 * /auth/me가 네트워크·5xx로 실패하면 user=null·error!=null이 되는데, 이때 깨진 화면
 * (이름 없음·빈 계정 정보 등)이나 잘못된 리다이렉트 대신 재시도 화면을 보여준다.
 *
 * user === null 동안의 분기:
 * - 조회 실패(error!=null) 또는 수동 재시도 중(retrying): 재시도 화면
 * - 조회 진행 중(isLoading, 초기 자동 재시도 포함): 로딩 화면
 *   → user=null 상태의 children(빈 사용자 UI)을 노출하지 않는다.
 * - 그 외(정상 401: error=null·!isLoading): 통과 (서버 프록시가 라우트 보호)
 *
 * 로그인 사용자(user!=null)는 항상 통과한다. 로그아웃 실패는 user가 살아있어(error만 set)
 * 보호 영역을 가리지 않는다.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, error, isLoading, refetch } = useAuth();
  const [retrying, setRetrying] = useState(false);

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

  if (user === null && isLoading) {
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
