interface SynergyRecommendation {
  priority: number;
  category: string;
  name: string;
  reason: string;
  expectedEffect: string;
  estimatedDuration?: string;
}

interface SynergyRecommendationsSectionProps {
  recommendations: SynergyRecommendation[];
}

export default function SynergyRecommendationsSection({
  recommendations,
}: SynergyRecommendationsSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">시너지 추천</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {recommendations.map((r) => (
          <div
            key={r.priority}
            className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-brand text-text-on-brand text-caption font-semibold">
                {r.priority}
              </span>
              <span className="text-caption text-text-tertiary">{r.category}</span>
            </div>
            <h3 className="text-body text-text-primary font-medium leading-snug">{r.name}</h3>
            <p className="text-body-sm text-text-secondary leading-relaxed">{r.reason}</p>
            <div className="bg-surface-secondary rounded px-2 py-1.5 mt-auto">
              <p className="text-caption text-text-tertiary">기대 효과</p>
              <p className="text-body-sm text-text-primary mt-0.5 leading-relaxed">{r.expectedEffect}</p>
            </div>
            {r.estimatedDuration && (
              <p className="text-caption text-text-tertiary">예상 기간: {r.estimatedDuration}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
