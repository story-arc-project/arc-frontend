"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { isAdminCustomersEnabled } from "@/lib/admin/flags";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 정확 일치로만 활성 판정(하위 경로 없는 개요) */
  exact: boolean;
  /** 실제 기능 준비 여부 — false 면 "준비 중" 뱃지를 붙인다(후속 이슈에서 true 로) */
  ready: boolean;
}

// 후속 이슈가 채울 자리를 미리 잡아둔 네비. page.tsx 본문 교체 + ready:true 전환만으로 열린다.
// 고객=FRT-16/17, 행동 분석=FRT-18~20, 감사 로그=BAC-14.
// 고객의 ready 는 FRT-16 플래그로 구동한다 — 백엔드(BAC-16) 배포 시 env 하나만 켜면 "준비 중"
// 뱃지 제거와 페이지 개방이 동시에 일어난다.
function getAdminNavItems(): AdminNavItem[] {
  return [
    { href: "/admin", label: "개요", icon: LayoutDashboard, exact: true, ready: true },
    { href: "/admin/customers", label: "고객", icon: Users, exact: false, ready: isAdminCustomersEnabled() },
    { href: "/admin/analytics", label: "행동 분석", icon: BarChart3, exact: false, ready: false },
    { href: "/admin/audit-log", label: "감사 로그", icon: ScrollText, exact: false, ready: false },
  ];
}

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminNav() {
  const pathname = usePathname();
  const items = getAdminNavItems();

  return (
    <nav
      aria-label="관리자 네비게이션"
      className="shrink-0 border-b border-border bg-surface md:w-56 md:border-b-0 md:border-r"
    >
      <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-body-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "bg-surface-brand font-semibold text-brand"
                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
                ].join(" ")}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="whitespace-nowrap">{item.label}</span>
                {!item.ready && (
                  <span className="ml-auto hidden rounded bg-surface-tertiary px-1.5 py-0.5 text-caption text-text-tertiary md:inline">
                    준비 중
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
