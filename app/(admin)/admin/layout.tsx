import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

import { requireAdmin } from "@/lib/auth/admin";
import { AdminNav } from "@/components/features/admin/AdminNav";

// 사용자별 인가 판정이 필요하므로 정적 프리렌더/캐시를 끈다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ARC Admin",
  // 관리자 영역은 검색엔진에서 완전히 제외한다. robots.txt Disallow 는 오히려 경로를
  // 광고하므로 쓰지 않고, 메타 로봇으로만 noindex 한다. (FRT-15 AC)
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 서버사이드 가드: admin 이 아니면(비로그인 포함) notFound() 로 404 → 경로 존재 은닉.
  // 미들웨어 단독 의존을 피한 서버 컴포넌트 검증이다(CVE-2025-29927). 보안 본체는 백엔드(BAC-13).
  await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
        <span className="flex items-center gap-2 text-heading-3 font-bold tracking-widest text-text-primary">
          <Shield size={18} className="text-brand" aria-hidden="true" />
          ARC
          <span className="text-body-sm font-semibold tracking-normal text-text-tertiary">
            Admin
          </span>
        </span>
        <Link
          href="/dashboard"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          앱으로 돌아가기
        </Link>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <AdminNav />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
