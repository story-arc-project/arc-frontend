import Link from "next/link";

interface NavItem {
  href: string;
  title: string;
}

export function PortfolioPostNav({
  prev,
  next,
  indexHref,
}: {
  prev?: NavItem;
  next?: NavItem;
  indexHref: string;
}) {
  return (
    <nav className="mt-10 border-t border-border pt-6">
      <Link href={indexHref} className="text-label text-brand hover:underline">
        ← 전체 포트폴리오로
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          {prev && (
            <Link
              href={prev.href}
              className="block rounded-xl border border-border p-3 text-left transition-colors hover:border-brand"
            >
              <span className="text-caption text-text-tertiary">이전 경험</span>
              <span className="mt-0.5 block truncate text-body text-text-primary">{prev.title}</span>
            </Link>
          )}
        </div>
        <div>
          {next && (
            <Link
              href={next.href}
              className="block rounded-xl border border-border p-3 text-right transition-colors hover:border-brand"
            >
              <span className="text-caption text-text-tertiary">다음 경험</span>
              <span className="mt-0.5 block truncate text-body text-text-primary">{next.title}</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
