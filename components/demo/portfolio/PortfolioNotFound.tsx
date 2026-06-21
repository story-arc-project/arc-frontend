import Link from "next/link";

/**
 * 존재하지 않는 포트폴리오 id 로 진입했을 때의 fail-closed 상태.
 * 시드를 대신 노출하지 않고 명시적으로 "찾을 수 없음"을 보여준다.
 */
export function PortfolioNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-secondary px-6 text-center">
      <p className="text-caption uppercase tracking-wider text-text-tertiary">e-포트폴리오</p>
      <h1 className="text-heading-2 text-text-primary">포트폴리오를 찾을 수 없어요</h1>
      <p className="max-w-sm text-body text-text-secondary">
        요청한 포트폴리오가 존재하지 않거나 더 이상 공개되지 않았어요.
      </p>
      <Link
        href="/demo/export"
        className="mt-2 inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-button text-white transition-colors hover:bg-brand-dark"
      >
        익스포트로 돌아가기
      </Link>
    </main>
  );
}
