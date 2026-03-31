"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/archive", label: "아카이브" },
  { href: "/analysis", label: "분석" },
  { href: "/export", label: "익스포트" },
];

export function GNB() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-10 h-12 flex items-center px-4 gap-6 border-b border-border bg-surface">
      <Link href="/" className="text-label font-bold text-text-primary tracking-tight">
        ARC
      </Link>

      <nav className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "px-3 py-1.5 rounded-md text-label transition-colors duration-150",
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
    </header>
  );
}
