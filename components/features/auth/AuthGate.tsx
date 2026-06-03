"use client";

import { useState } from "react";

import { useAuth } from "@/hooks/useAuth";

/**
 * 보호 영역(/(main)) 진입 시 인증 조회 자체가 실패한 경우를 처리한다.
 *
 * /auth/me가 네트워크·5xx로 실패하면 user=null·error!=null이 되는데, 이때
 * 깨진 화면(이름 없음·빈 계정 정보 등)을 그대로 노출하는 대신 재시도 화면을 보여준다.
 *
 * - 비로그인(정상 401): user=null·error=null → 통과 (서버 프록시가 라우트 보호)
 * - 로그아웃 실패: user!=null·error!=null → 통과 (세션은 유효, 보호 영역을 가리지 않음)
 * - 조회 실패: user=null·error!=null → 오류 화면 노출
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, error, refetch } = useAuth();
  const [retrying, setRetrying] = useState(false);

  // 재시도 중에는 refetch가 error를 잠시 비워도 보호 페이지가 깜빡이지 않도록 화면을 유지한다.
  const showError = user === null && (error !== null || retrying);

  if (showError) {
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

  return <>{children}</>;
}
