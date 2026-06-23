import type { DemoValueCard } from "@/lib/demo/content";

export function PortfolioValues({ values }: { values: DemoValueCard[] }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="mb-4 text-title text-text-primary">가치관</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {values.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <span className="text-heading-2">{card.icon}</span>
            <p className="mt-2 text-title text-text-primary">{card.title}</p>
            <p className="mt-2 text-body text-text-secondary">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
