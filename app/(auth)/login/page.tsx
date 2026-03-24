"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const pwInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // API 연동 예정
  }

  function handleSocialLogin(provider: string) {
    // API 연동 예정
  }

  return (
    <div className="w-2/3 min-w-80 max-w-lg">
      <div className="h-8 mb-3" />
      <div className="bg-surface border border-border rounded-xl px-10 py-10 shadow-sm">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-0"
        >
          <motion.div variants={item} className="mb-8 text-center">
            <h1 className="text-heading-2 text-text-primary mb-1">다시 만나요</h1>
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
            <div className="mt-1">
              <Button type="submit" size="lg" fullWidth>
                로그인
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
