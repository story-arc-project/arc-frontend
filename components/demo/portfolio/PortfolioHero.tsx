import type { PortfolioProfile } from "@/types/portfolio";

export function PortfolioHero({ profile }: { profile: PortfolioProfile }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-surface-brand text-heading-2 text-brand">
          {profile.name.slice(0, 1)}
        </div>
        <p className="text-caption uppercase tracking-wider text-text-tertiary">e-포트폴리오</p>
        <h1 className="mt-1 text-heading-1 text-text-primary">{profile.name}</h1>
        <p className="mt-3 text-body text-text-secondary">{profile.headline}</p>
        {profile.strengthTags.length > 0 && (
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {profile.strengthTags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-surface-brand px-3 py-1 text-caption text-brand"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
