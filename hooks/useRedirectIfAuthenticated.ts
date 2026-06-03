"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

type Options = {
  /**
   * 온보딩 미완료 인증 사용자에게 페이지 접근을 허용한다.
   * 예: /signup?step=profile 흐름에서 사용.
   */
  allowOnboardingFlow?: boolean;
};

export function useRedirectIfAuthenticated({ allowOnboardingFlow = false }: Options = {}) {
  const router = useRouter();
  const { isAuthenticated, isOnboarded, isLoading, error } = useAuth();

  // 인증 조회가 실패하면(error) 로그인 여부를 확신할 수 없으므로 리다이렉트하지 않는다.
  // (error 시 isAuthenticated는 false이지만, "비로그인"으로 단정해 이동하는 것을 명시적으로 막는다.)
  const shouldRedirect =
    !isLoading && !error && isAuthenticated && (isOnboarded || !allowOnboardingFlow);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace(isOnboarded ? "/dashboard" : "/signup?step=profile");
  }, [shouldRedirect, isOnboarded, router]);

  return { isLoading, shouldRedirect, error };
}
