import type { KeywordCoverage } from "@/types/analysis";

interface CoverageSectionProps {
  coverage: KeywordCoverage[];
}

export default function CoverageSection({ coverage }: CoverageSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">키워드 커버리지</h3>

      <div className="space-y-3">
        {coverage.map((item) => {
          const pct =
            item.totalCount > 0
              ? Math.round((item.matchedCount / item.totalCount) * 100)
              : 0;
          return (
            <div
              key={item.keywordId}
              className="bg-surface border border-border rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-body-sm text-text-primary font-medium">
                  {item.label}
                </span>
                <span className="text-body-sm text-text-secondary font-medium">
                  {item.matchedCount}/{item.totalCount} ({pct}%)
                </span>
              </div>
              <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
