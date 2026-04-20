interface KeywordClusteringSectionProps {
  personalityTendency: string[];
  coreCompetency: string[];
  jobIndustry: string[];
}

const groups = [
  { key: "personalityTendency" as const, label: "성향" },
  { key: "coreCompetency" as const, label: "핵심 역량" },
  { key: "jobIndustry" as const, label: "추천 직군·산업" },
];

export default function KeywordClusteringSection(props: KeywordClusteringSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">키워드 클러스터링</h2>

      <div className="bg-surface border border-border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="text-label text-text-tertiary mb-2">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {props[g.key].map((item) => (
                <span
                  key={item}
                  className="bg-surface-brand text-brand-dark rounded-full px-2.5 py-0.5 text-caption font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
