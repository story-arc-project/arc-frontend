"use client";

import Link from "next/link";
import { X, ArrowLeft, ArrowRight } from "lucide-react";

import { useDemoMode } from "@/contexts/DemoModeContext";

export function DemoTourModal() {
  const { step, stepIndex, totalSteps, isFirst, isLast, open, next, prev, skip } = useDemoMode();

  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-label="데모 가이드"
      className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] bg-surface border border-border rounded-xl shadow-lg p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-caption text-text-tertiary font-medium">
            {stepIndex + 1} / {totalSteps}
          </p>
          <h2 className="text-title text-text-primary mt-1">{step.title}</h2>
        </div>
        <button
          type="button"
          onClick={skip}
          aria-label="가이드 닫기"
          className="p-1 -m-1 rounded text-text-tertiary hover:text-text-primary transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <p className="text-body-sm text-text-secondary leading-relaxed mb-5">
        {step.body}
      </p>

      <footer className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={prev}
          disabled={isFirst}
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          이전
        </button>

        {isLast ? (
          <Link
            href="/signup"
            className="h-9 px-4 bg-brand text-white text-body-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors inline-flex items-center gap-1"
          >
            회원가입하고 직접 써보기
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={next}
            className="h-9 px-4 bg-brand text-white text-body-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors inline-flex items-center gap-1"
          >
            {step.nextLabel ?? "다음"}
          </button>
        )}
      </footer>
    </aside>
  );
}
