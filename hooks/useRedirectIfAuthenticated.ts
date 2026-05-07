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
  const { isAuthenticated, isOnboarded, isLoading } = useAuth();

  const shouldRedirect =
    !isLoading && isAuthenticated && (isOnboarded || !allowOnboardingFlow);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace(isOnboarded ? "/dashboard" : "/signup?step=profile");
  }, [shouldRedirect, isOnboarded, router]);

  return { isLoading, shouldRedirect };
}
