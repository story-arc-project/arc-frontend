"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { useDemoMode } from "@/contexts/DemoModeContext";

const DEMO_NAV_ITEMS = [
  { href: "/demo/archive", label: "아카이브" },
  { href: "/demo/analysis", label: "분석" },
  { href: "/demo/export", label: "익스포트" },
];

export function DemoGNB() {
  const pathname = usePathname();
  const { reopen } = useDemoMode();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="no-print fixed inset-x-0 top-0 z-50 h-[var(--gnb-h)] border-b border-border bg-surface/90 backdrop-blur-sm">
      <div className="w-full mx-auto px-6 h-full flex items-center gap-6">
        <Link href="/demo/archive" className="text-heading-3 font-bold text-text-primary tracking-widest">
          ARC
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1 flex-1">
          {DEMO_NAV_ITEMS.map((item) => {
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

        {/* Right actions */}
        <div className="hidden sm:flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={reopen}
            className="text-body-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            가이드 다시 보기
          </button>
          <Link
            href="/signup"
            className="h-8 px-4 bg-brand text-text-on-brand text-body-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors inline-flex items-center"
          >
            회원가입
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 -mr-2 ml-auto text-text-secondary hover:text-text-primary transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴 열기"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="sm:hidden border-t border-border bg-surface px-6 py-3 space-y-1">
          {DEMO_NAV_ITEMS.map((item) => {
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
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setMobileOpen(false); reopen(); }}
              className="block px-3 py-2.5 text-left text-body-large text-text-secondary hover:text-text-primary transition-colors"
            >
              가이드 다시 보기
            </button>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-body-large text-brand font-semibold"
            >
              회원가입
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
