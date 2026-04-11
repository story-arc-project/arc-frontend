"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  FileSearch,
  Layers,
  Tags,
  Star,
  ChevronDown,
} from "lucide-react";

const SNB_ITEMS = [
  { href: "/analysis", label: "분석 홈", icon: LayoutDashboard, exact: true },
  { href: "/analysis/individual", label: "개별 경험 분석", icon: FileSearch, exact: false },
  { href: "/analysis/comprehensive", label: "종합 분석", icon: Layers, exact: false },
  { href: "/analysis/keyword", label: "키워드 분석", icon: Tags, exact: false },
  { href: "/analysis/bookmarks", label: "즐겨찾기", icon: Star, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AnalysisSNB() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = SNB_ITEMS.find((item) => isActive(pathname, item.href, item.exact));

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, closeMobile]);

  return (
    <>
      {/* Desktop SNB */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-surface-secondary overflow-y-auto">
        <nav className="p-3 space-y-1" aria-label="분석 탭 네비게이션">
          {SNB_ITEMS.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-body-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "bg-surface-brand text-brand font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary",
                ].join(" ")}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile: dropdown navigation */}
      <div className="md:hidden border-b border-border bg-surface relative">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="analysis-mobile-nav"
          className="flex items-center justify-between w-full px-4 py-3 text-body-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
        >
          <span className="flex items-center gap-2">
            {current && <current.icon size={16} className="text-brand" />}
            {current?.label ?? "분석"}
          </span>
          <ChevronDown
            size={16}
            className={[
              "text-text-tertiary transition-transform duration-200",
              mobileOpen ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {mobileOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={closeMobile}
              aria-hidden="true"
            />
            <nav
              id="analysis-mobile-nav"
              className="absolute left-0 right-0 top-full z-20 bg-surface border-b border-border shadow-sm px-2 pb-2 space-y-0.5"
              aria-label="분석 탭 네비게이션"
            >
              {SNB_ITEMS.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-body-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                      active
                        ? "bg-surface-brand text-brand font-semibold"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary",
                    ].join(" ")}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>
    </>
  );
}
