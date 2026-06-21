import Link from "next/link";

import type { PortfolioPost } from "@/types/portfolio";

export function PortfolioPostCard({ post, href }: { post: PortfolioPost; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-brand"
    >
      <div className="flex items-center gap-2 text-caption text-text-tertiary">
        <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-text-secondary">
          {post.category}
        </span>
        {post.period && <span>{post.period}</span>}
      </div>
      <h3 className="mt-2 text-title text-text-primary">{post.title}</h3>
      {post.summary && (
        <p className="mt-2 line-clamp-2 text-body text-text-secondary">{post.summary}</p>
      )}
      {post.keywords.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {post.keywords.slice(0, 4).map((kw) => (
            <li key={kw} className="text-caption text-text-tertiary">
              #{kw}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
