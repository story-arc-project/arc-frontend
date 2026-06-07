"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import {
  clearOAuthState,
  readOAuthState,
  readOAuthIntent,
  clearOAuthIntent,
} from "@/lib/auth/oauth-state";
import { deleteAccountWithSocial } from "@/lib/api/auth-api";
import { DELETE_INTENT } from "@/lib/auth/oauth-providers";
import { AuthSuccessResult } from "@/types/auth";

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
    const intent = readOAuthIntent();
    clearOAuthState();
    clearOAuthIntent();

    // ── 탈퇴(재인증) 분기 ──────────────────────────────
    // 소셜 계정 탈퇴는 OAuth 재실행으로 본인 확인 후 이 콜백으로 돌아온다(FRT-9).
    if (intent === DELETE_INTENT) {
      if (error || !code || !returnedState || !storedState || returnedState !== storedState) {
        router.replace("/settings?deleteError=1");
        return;
      }
      deleteAccountWithSocial(code)
        .then(() => {
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
      .then((result) => {
        if (result.data.onboarded) {
          // 하드 내비게이션으로 AuthProvider를 재마운트해 소셜 로그인 직후 user를 다시 불러온다.
          // (클라이언트 replace만으로는 루트 컨텍스트의 user가 null로 남아 GNB 계정 메뉴가 가려진다.)
          // replace로 콜백 페이지를 히스토리에 남기지 않는다.
          window.location.replace("/dashboard");
        } else {
          router.push(`/signup?step=profile&email=${encodeURIComponent(result.data.user.email)}`);
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
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-body text-text-tertiary">로그인 처리 중...</p>
    </div>
  );
}
