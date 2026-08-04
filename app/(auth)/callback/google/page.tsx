"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { capture, resetUser, markSignupCompletedIfUnseen } from "@/lib/analytics";
import { clearOAuthState, readOAuthState } from "@/lib/auth/oauth-state";
import { deleteAccountWithSocial } from "@/lib/api/auth-api";
import { DELETE_INTENT } from "@/lib/auth/oauth-providers";
import { AuthSuccessResult } from "@/types/auth";
import { FIRST_ONBOARDING_STEP } from "@/app/(auth)/constants";

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallbackHandler />
    </Suspense>
  );
}

function GoogleCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const returnedState = searchParams.get("state");
    const storedState = readOAuthState();
    clearOAuthState();

    // ── 탈퇴(재인증) 분기 ──────────────────────────────
    // 소셜 계정 탈퇴는 OAuth 재실행으로 본인 확인 후 이 콜백으로 돌아온다(FRT-9).
    // 의도는 state 값(`delete:` 접두사)에 바인딩돼 provider 가 그대로 echo 하므로,
    // 중단된 탈퇴의 잔여 의도가 이후 일반 로그인 콜백에 누수되지 않는다(별도 intent 쿠키 없음).
    if (returnedState?.startsWith(`${DELETE_INTENT}:`)) {
      if (error || !code || !returnedState || !storedState || returnedState !== storedState) {
        router.replace("/settings?deleteError=1");
        return;
      }
      deleteAccountWithSocial(code)
        .then(() => {
          // 탈퇴 완료 — 분석 식별을 익명으로 되돌린다. 하드 내비게이션이라 AuthContext effect 가
          // 실행되지 않으므로, 삭제된 계정의 distinct_id 가 다음 사용자에 새지 않게 여기서 reset.
          resetUser();
          // 1회성 마커는 사용자별 키라 여기서 비우지 않는다 — 이 기기의 다음 사용자는
          // 자기 키로 정상 발화한다.
          // 하드 내비게이션으로 AuthProvider 재마운트 → 컨텍스트 상태 정리.
          window.location.replace("/login?deleted=1");
        })
        .catch(() => {
          router.replace("/settings?deleteError=1");
        });
      return;
    }

    if (error || !code) {
      router.replace("/login?error=social_cancelled");
      return;
    }

    if (!returnedState || !storedState || returnedState !== storedState) {
      router.replace("/login?error=social_failed");
      return;
    }

    api
      .post<AuthSuccessResult>("/auth/social-login", { provider : "google", token : code }, { auth: false })
      .then(async (result) => {
        if (result.data.onboarded) {
          // 하드 내비게이션으로 AuthProvider를 재마운트해 소셜 로그인 직후 user를 다시 불러온다.
          // (클라이언트 replace만으로는 루트 컨텍스트의 user가 null로 남아 GNB 계정 메뉴가 가려진다.)
          // replace로 콜백 페이지를 히스토리에 남기지 않는다.
          window.location.replace("/dashboard");
        } else {
          // 미온보딩 소셜 로그인 = 신규 소셜 가입 완료 확정 지점(온보딩으로 진행).
          // onboarded=true 분기는 기존 사용자 재로그인이라 signup 으로 잡지 않는다.
          // 온보딩을 중도 이탈한 계정은 재로그인해도 onboarded=false 라 이 분기를 다시 타므로,
          // 사용자별 마커로 재발화를 막는다(백엔드에 '신규 계정' 신호가 없어 최선 노력).
          if (await markSignupCompletedIfUnseen(result.data.user.email)) {
            capture("signup_completed", { method: "google" });
          }
          router.push(`/signup?step=${FIRST_ONBOARDING_STEP}&email=${encodeURIComponent(result.data.user.email)}`);
        }
      })
      .catch((e) => {
        const msg =
          e instanceof ApiError && e.status === 409
            ? "already_exists"
            : "social_failed";
        router.replace(`/login?error=${msg}`);
      });
  }, [router, searchParams]);

  return (
    // 세로 위치는 (auth) 레이아웃이 잡는다. 여기서 min-h-screen 을 겹치면
    // 화면 한 개 분량이 더 밀려 로딩 문구가 아래로 내려간다.
    <div className="flex items-center justify-center">
      <p className="text-body text-text-tertiary">로그인 처리 중...</p>
    </div>
  );
}
