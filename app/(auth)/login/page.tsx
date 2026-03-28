"use client";

import { FormEvent, Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Button, Input } from "@/components/ui";
import { SocialLoginButtons } from "@/components/features/auth/SocialLoginButtons";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const pwInputRef = useRef<HTMLInputElement>(null);

  // 오픈 리다이렉트 방지: 상대 경로만 허용
  const rawCallback = searchParams.get("callbackUrl") ?? "/dashboard";
  const callbackUrl = rawCallback.startsWith("/") && !rawCallback.startsWith("//") ? rawCallback : "/dashboard";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    try {
      // Step 1: Call FastAPI directly — browser receives httpOnly cookies (access + refresh token)
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        const { detail } = await loginRes.json().catch(() => ({}));
        if (detail === "ACCOUNT_LOCKED") {
          setError("계정이 잠겼어요. 잠시 후 다시 시도해주세요.");
        } else if (detail === "EMAIL_NOT_VERIFIED") {
          router.push(`/signup?step=verify&email=${encodeURIComponent(email)}`);
        } else {
          setError("이메일 또는 비밀번호가 올바르지 않아요.");
        }
        return;
      }

      const { data } = await loginRes.json();

      // Step 2: Create NextAuth session — pass name from login response
      const result = await signIn("credentials", {
        email,
        name: data.user.nickname,
        redirect: false,
      });

      if (result?.error) {
        setError("로그인 중 오류가 발생했어요. 다시 시도해주세요.");
      } else if (!data.onboarded) {
        router.push(`/signup?step=profile&email=${encodeURIComponent(email)}`);
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSocialLogin(provider: string) {
    if (provider !== "google") {
      setSocialError("곧 지원 예정이에요");
      setTimeout(() => setSocialError(null), 3000);
      return;
    }
    await signIn("google", { callbackUrl });
  }

  return (
    <div className="w-full max-w-lg">
      <div className="h-8 mb-3" />
      <div className="sm:bg-surface sm:border sm:border-border sm:rounded-xl sm:shadow-sm px-0 py-0 sm:px-10 sm:py-10">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-0"
        >
          <motion.div variants={item} className="mb-8 text-center">
            <h1 className="text-heading-2 text-text-primary mb-1">반가워요</h1>
            <p className="text-body text-text-secondary">이메일로 로그인하세요</p>
          </motion.div>

          <motion.div variants={item} className="flex flex-col gap-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="이메일"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && pwInputRef.current?.focus()}
              />
              <div className="relative">
                <Input
                  ref={pwInputRef}
                  label="비밀번호"
                  type={showPw ? "text" : "password"}
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-[38px] text-caption text-text-tertiary
                             hover:text-text-secondary transition-colors cursor-pointer select-none"
                >
                  {showPw ? "숨기기" : "보기"}
                </button>
              </div>
              {error && (
                <p className="text-body-sm text-error">{error}</p>
              )}
              <div className="mt-1">
                <Button type="submit" size="lg" fullWidth disabled={isLoading || !email || !password}>
                  {isLoading ? "로그인 중..." : "로그인"}
                </Button>
              </div>
            </form>
          </motion.div>

          <motion.div variants={item} className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-border" />
            <span className="text-caption text-text-tertiary whitespace-nowrap">또는 소셜 계정으로 계속하기</span>
            <div className="flex-1 border-t border-border" />
          </motion.div>

          <motion.div variants={item}>
            <SocialLoginButtons onLogin={handleSocialLogin} action="계속하기" />
            {socialError && (
              <p className="mt-2 text-center text-body-sm text-text-tertiary">{socialError}</p>
            )}
          </motion.div>

          <motion.p variants={item} className="mt-6 text-center text-body-sm text-text-secondary">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-brand font-medium hover:underline">
              회원가입
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
