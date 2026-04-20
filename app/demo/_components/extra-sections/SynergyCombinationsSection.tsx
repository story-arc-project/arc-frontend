interface SynergyCombination {
  combinationTitle: string;
  items: string[];
  synergyReason: string;
  expectedEffect: string;
  applicableRoles: string[];
}

interface SynergyCombinationsSectionProps {
  combinations: SynergyCombination[];
}

export default function SynergyCombinationsSection({
  combinations,
}: SynergyCombinationsSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">시너지 조합</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {combinations.map((c) => (
          <div
            key={c.combinationTitle}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            <h3 className="text-body text-text-primary font-medium">{c.combinationTitle}</h3>
            <div className="flex flex-wrap gap-1.5">
              {c.items.map((item) => (
                <span
                  key={item}
                  className="bg-surface-secondary text-text-secondary rounded-full px-2.5 py-0.5 text-caption"
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="text-body-sm text-text-secondary leading-relaxed">{c.synergyReason}</p>
            <div className="bg-surface-brand rounded px-2 py-1.5">
              <p className="text-caption text-brand-dark">기대 효과</p>
              <p className="text-body-sm text-text-primary mt-0.5 leading-relaxed">{c.expectedEffect}</p>
            </div>
            <div>
              <p className="text-caption text-text-tertiary mb-1.5">적합 직무</p>
              <div className="flex flex-wrap gap-1.5">
                {c.applicableRoles.map((r) => (
                  <span
                    key={r}
                    className="bg-surface-brand text-brand-dark rounded-full px-2.5 py-0.5 text-caption font-medium"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
