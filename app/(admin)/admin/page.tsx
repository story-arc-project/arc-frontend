import type { Metadata } from "next";
import Link from "next/link";
import { Users, BarChart3, ScrollText, ArrowRight, type LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "개요 · ARC Admin",
};

interface OverviewSection {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

// 개요는 admin 셸의 실 콘텐츠(랜딩). 각 운영 영역으로 가는 진입 카드를 제공한다.
const SECTIONS: OverviewSection[] = [
  {
    href: "/admin/customers",
    label: "고객 정보 조회",
    description: "가입자 목록·검색·상세와 활동 요약. 개인정보 최소 노출 원칙.",
    icon: Users,
  },
  {
    href: "/admin/analytics",
    label: "행동 분석",
    description: "핵심 퍼널·리텐션·이탈 추적(PostHog).",
    icon: BarChart3,
  },
  {
    href: "/admin/audit-log",
    label: "감사 로그",
    description: "고객 데이터 조회·익스포트 기록 추적.",
    icon: ScrollText,
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-heading-2 text-text-primary">관리자 개요</h1>
        <p className="mt-1 text-body text-text-secondary">
          ARC 운영 도구입니다. 아래 영역을 순차적으로 제공할 예정이에요.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary text-text-secondary">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="rounded bg-surface-tertiary px-2 py-0.5 text-caption text-text-tertiary">
                  준비 중
                </span>
              </div>
              <div>
                <h2 className="flex items-center gap-1 text-body-lg font-semibold text-text-primary">
                  {section.label}
                  <ArrowRight
                    size={16}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </h2>
                <p className="mt-1 text-body-sm text-text-secondary">{section.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
