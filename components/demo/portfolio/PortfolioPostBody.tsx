import type { PortfolioPost } from "@/types/portfolio";

function Section({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <section className="mt-6">
      <h2 className="text-title text-text-primary">{label}</h2>
      <p className="mt-2 whitespace-pre-line text-body text-text-secondary">{text}</p>
    </section>
  );
}

export function PortfolioPostBody({ post }: { post: PortfolioPost }) {
  return (
    <article>
      <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
        <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-text-secondary">
          {post.category}
        </span>
        {post.period && <span>{post.period}</span>}
      </div>
      <h1 className="mt-3 text-heading-2 text-text-primary">{post.title}</h1>
      <Section label="한 줄 요약" text={post.summary} />
      <Section label="내 역할" text={post.contribution} />
      <Section label="핵심 성과" text={post.achievement} />
      {post.keywords.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {post.keywords.map((kw) => (
            <li key={kw} className="rounded-full bg-surface-brand px-3 py-1 text-caption text-brand">
              #{kw}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
