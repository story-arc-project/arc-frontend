"use client";

import Link from "next/link";
import { Info } from "lucide-react";

import { useDemoMode } from "@/contexts/DemoModeContext";

export function DemoBanner() {
  const { reopen } = useDemoMode();

  return (
    <div className="bg-surface-brand text-brand-dark border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-body-sm">
        <Info size={14} aria-hidden="true" className="shrink-0" />
        <p className="flex-1 leading-relaxed">
          데모 모드 — 입력은 저장되지 않으며 새로고침 시 초기화됩니다.
        </p>
        <button
          type="button"
          onClick={reopen}
          className="text-brand-dark font-medium underline underline-offset-2 hover:opacity-80 transition-opacity shrink-0"
        >
          가이드 다시 보기
        </button>
        <Link
          href="/signup"
          className="text-brand-dark font-medium underline underline-offset-2 hover:opacity-80 transition-opacity shrink-0"
        >
          회원가입
        </Link>
      </div>
    </div>
  );
}
