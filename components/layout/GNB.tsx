"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "./UserMenu";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/archive", label: "아카이브" },
  { href: "/analysis", label: "분석" },
  { href: "/export", label: "익스포트" },
];

export function GNB() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="no-print fixed inset-x-0 top-0 z-50 h-[var(--gnb-h)] border-b border-border bg-surface/90 backdrop-blur-sm">
      <div className="w-full mx-auto px-6 h-full flex items-center gap-6">
        <Link href="/" className="text-heading-3 font-bold text-text-primary tracking-widest">
          ARC
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "px-3 py-1.5 rounded-md text-body-large transition-colors duration-150",
                  isActive
                    ? "text-brand font-semibold bg-surface-brand"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center">
          {/* Desktop user menu */}
          <div className="hidden sm:block">
            <UserMenu />
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="메뉴 열기"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="sm:hidden border-t border-border bg-surface px-6 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={[
                  "block px-3 py-2.5 rounded-md text-body-large transition-colors duration-150",
                  isActive
                    ? "text-brand font-semibold bg-surface-brand"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}

          {user && (
            <>
              <div className="my-2 border-t border-border" />
              <div className="px-3 py-2">
                <p className="truncate text-body-sm font-semibold text-text-primary">
                  {user.profile?.name ?? user.account?.email ?? "사용자"}
                </p>
                <p className="truncate text-caption">{user.account?.email}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-md text-body text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors duration-150"
              >
                마이페이지
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="block w-full text-left px-3 py-2.5 rounded-md text-body text-error hover:bg-surface-tertiary transition-colors duration-150"
              >
                로그아웃
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
