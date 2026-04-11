import type { Keyword, KeywordCategory } from "@/types/analysis";
import { keywordCategoryLabel } from "@/types/analysis";
import ConfidenceBadge from "../common/ConfidenceBadge";
import EvidenceQuote from "../common/EvidenceQuote";

interface KeywordPatternSectionProps {
  keywords: Keyword[];
}

const CATEGORY_ORDER: KeywordCategory[] = [
  "skill",
  "work_style",
  "value",
  "job_domain",
];

export default function KeywordPatternSection({
  keywords,
}: KeywordPatternSectionProps) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: keywords
      .filter((k) => k.category === cat)
      .sort((a, b) => {
        const order = { sufficient: 0, partial: 1, insufficient: 2 };
        return order[a.confidence] - order[b.confidence];
      }),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">역량 · 강점 분석</h3>

      <div className="space-y-6">
        {grouped.map(({ category, items }) => (
          <div key={category}>
            <p className="text-label text-text-tertiary mb-3">
              {keywordCategoryLabel[category]}
            </p>
            <div className="space-y-3">
              {items.map((kw) => (
                <div
                  key={kw.id}
                  className="bg-surface border border-border rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-body-sm text-text-primary font-medium">
                      {kw.label}
                    </span>
                    <ConfidenceBadge confidence={kw.confidence} />
                  </div>
                  <div className="space-y-2">
                    {kw.evidences.map((ev, i) => (
                      <EvidenceQuote key={i} evidence={ev} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
