"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

  return (
    <>
      {/* Desktop SNB */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-surface-secondary overflow-y-auto">
        <nav className="p-3 space-y-1">
          {SNB_ITEMS.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-body-sm transition-colors duration-150",
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
      </aside>

      {/* Mobile: horizontal tab bar */}
      <div className="md:hidden border-b border-border bg-surface">
        {/* Dropdown trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center justify-between w-full px-4 py-3 text-body-sm font-medium text-text-primary"
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

        {/* Dropdown menu */}
        {mobileOpen && (
          <nav className="px-2 pb-2 space-y-0.5">
            {SNB_ITEMS.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-body-sm transition-colors duration-150",
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
        )}
      </div>
    </>
  );
}
