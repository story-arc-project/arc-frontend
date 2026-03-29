"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

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

    if (error || !code) {
      router.replace("/login?error=social_cancelled");
      return;
    }

    api
      .post<{ status: string }>("/auth/social-login", { provider : "google", token : code }, { auth: false })
      .then(() => {
        router.replace("/dashboard");
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
