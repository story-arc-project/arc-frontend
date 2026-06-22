import Link from "next/link";

export function PortfolioFooter() {
  return (
    <footer className="border-t border-border bg-surface-secondary">
      <div className="mx-auto max-w-3xl px-6 py-10 text-center">
        <p className="text-body text-text-secondary">
          이 포트폴리오는 ARC로 기록한 경험에서 자동으로 만들어졌어요.
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-label text-white transition-colors hover:bg-brand-dark"
        >
          나도 내 포트폴리오 만들기
        </Link>
      </div>
    </footer>
  );
}
