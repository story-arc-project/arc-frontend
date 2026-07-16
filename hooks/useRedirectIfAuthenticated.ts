"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { FIRST_ONBOARDING_STEP } from "@/app/(auth)/constants";

type Options = {
  /**
   * 온보딩 미완료 인증 사용자에게 페이지 접근을 허용한다.
   * 예: /signup?step=consent 흐름에서 사용.
   */
  allowOnboardingFlow?: boolean;
  /**
   * 인증 완료 사용자에게도 페이지 접근을 허용한다(리다이렉트 비활성화).
   * 예: 설정 → 비밀번호 변경(FRT-49)처럼 로그인 상태에서 의도적으로 진입하는 흐름.
   */
  allowAuthenticated?: boolean;
};

export function useRedirectIfAuthenticated({
  allowOnboardingFlow = false,
  allowAuthenticated = false,
}: Options = {}) {
  const router = useRouter();
  const { isAuthenticated, isOnboarded, isLoading, error } = useAuth();

  // 리다이렉트는 인증 상태(isAuthenticated)만으로 판단한다.
  // - /auth/me 조회 실패(5xx): user=null → isAuthenticated=false라 자연히 리다이렉트되지 않는다.
  // - 로그아웃 실패: user가 살아있어(인증 상태) error만 set되므로, error로 리다이렉트를 막으면
  //   유효 세션 사용자가 /login·/signup에 머무는 버그가 생긴다. → error는 가드 조건에 넣지 않는다.
  // - allowAuthenticated: 설정發 비밀번호 변경처럼 로그인 상태 진입을 명시 허용하는 흐름은 가드를 끈다.
  const shouldRedirect =
    !isLoading && isAuthenticated && !allowAuthenticated && (isOnboarded || !allowOnboardingFlow);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace(isOnboarded ? "/dashboard" : `/signup?step=${FIRST_ONBOARDING_STEP}`);
  }, [shouldRedirect, isOnboarded, router]);

  return { isLoading, shouldRedirect, error };
}
