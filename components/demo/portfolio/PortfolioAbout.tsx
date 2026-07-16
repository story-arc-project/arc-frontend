import type { DemoAbout } from "@/lib/demo/content";

export function PortfolioAbout({ about }: { about: DemoAbout }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="mb-4 text-title text-text-primary">나에 대해</h2>
      <p className="text-body text-text-secondary whitespace-pre-line">{about.narrative}</p>
      {about.awardsAndActivities.length > 0 && (
        <ul className="mt-6 flex flex-col gap-3">
          {about.awardsAndActivities.map((award) => (
            <li
              key={award.title}
              className="rounded-xl border border-border bg-surface px-4 py-3"
            >
              <p className="text-body text-text-primary">{award.title}</p>
              <p className="mt-0.5 text-caption text-text-tertiary">{award.period}</p>
              <p className="mt-0.5 text-caption text-brand">{award.note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
