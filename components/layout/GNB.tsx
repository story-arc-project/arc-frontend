"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/archive", label: "아카이브" },
  { href: "/analysis", label: "분석" },
  { href: "/export", label: "익스포트" },
];

export function GNB() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[var(--gnb-h)] border-b border-border bg-surface/90 backdrop-blur-sm">
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

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴 열기"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
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
        </nav>
      )}
    </header>
  );
}
