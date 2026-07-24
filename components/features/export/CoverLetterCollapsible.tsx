"use client";

import { ReactNode, useId, useState } from "react";
import { ChevronDown } from "lucide-react";

interface CoverLetterCollapsibleProps {
  title: string;
  /** 제목 옆 짧은 보조 설명(예: "회사 검색 결과"). */
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * 자소서 부가 산출물(작성 가이드·회사 리서치·액션플랜)을 접어 두는 섹션.
 *
 * 명세가 이 셋을 "접이식·사이드바로 표시 권장"이라 한 이유는 분량이다 — 작성 가이드 하나가
 * 전략·문단 해설·체크리스트·예상 면접 질문 3개를 담는다. 펼쳐 두면 **주 결과물인 본문이
 * 밀려난다**. 그래서 기본은 접힘이다.
 *
 * 높이는 애니메이션하지 않는다(레이아웃 속성). 접힘/펼침은 마운트로 처리한다.
 */
export function CoverLetterCollapsible({
  title,
  hint,
  defaultOpen = false,
  children,
}: CoverLetterCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-body-sm font-semibold text-text-primary">{title}</span>
          {hint && <span className="truncate text-caption text-text-tertiary">{hint}</span>}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={[
            "shrink-0 text-text-tertiary transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div id={panelId} className="border-t border-border px-4 py-3">
          {children}
        </div>
      )}
    </section>
  );
}
