import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 법적 문서(이용약관·개인정보 처리방침) 렌더러.
 * 단일 소스인 docs/legal/*.md 마크다운 문자열을 받아 디자인 토큰으로 렌더한다.
 * 빌드 타임 정적 프리렌더로 HTML이 baked 되므로 런타임 의존이 없다.
 */

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-heading-2 text-text-primary mt-10 mb-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-heading-3 text-text-primary mt-8 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-label font-semibold text-text-primary mt-5 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-body text-text-secondary leading-relaxed my-2">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 text-body text-text-secondary space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 text-body text-text-secondary space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="text-brand hover:underline">
      {children}
    </a>
  ),
  hr: () => <hr className="my-7 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-3 rounded-lg border border-border bg-surface-secondary px-4 py-3 text-body-sm text-text-secondary">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-body-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-surface-secondary px-3 py-2 text-left font-semibold text-text-primary">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-2 align-top text-text-secondary">{children}</td>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-secondary px-1.5 py-0.5 text-caption text-text-primary">
      {children}
    </code>
  ),
};

export function LegalDocument({ markdown }: { markdown: string }) {
  return (
    <main className="min-h-dvh bg-surface">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <Link href="/" className="text-body-sm text-text-tertiary hover:text-text-primary">
          ← ARC
        </Link>
        <article className="mt-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {markdown}
          </ReactMarkdown>
        </article>
      </div>
    </main>
  );
}
