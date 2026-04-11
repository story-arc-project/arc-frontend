import type { KeywordDefinition } from "@/types/analysis";
import { keywordCategoryLabel } from "@/types/analysis";
import { Badge } from "@/components/ui";

interface KeywordDefinitionSectionProps {
  definitions: KeywordDefinition[];
}

export default function KeywordDefinitionSection({
  definitions,
}: KeywordDefinitionSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">키워드 정의 · 부합 기준</h3>

      <div className="space-y-4">
        {definitions.map((def) => (
          <div
            key={def.keywordId}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-body text-text-primary font-medium">
                {def.label}
              </span>
              <Badge variant="outline">
                {keywordCategoryLabel[def.category]}
              </Badge>
            </div>

            <p className="text-body-sm text-text-secondary leading-relaxed">
              {def.redefinition}
            </p>

            {/* Synonyms */}
            <div className="flex flex-wrap gap-1.5">
              {def.synonyms.map((syn) => (
                <span
                  key={syn}
                  className="text-caption text-text-tertiary bg-surface-secondary px-2 py-0.5 rounded"
                >
                  {syn}
                </span>
              ))}
            </div>

            {/* Fit criteria checklist */}
            <div>
              <p className="text-caption text-text-tertiary font-medium mb-2">
                부합 기준
              </p>
              <ul className="space-y-1.5">
                {def.fitCriteria.map((fc) => (
                  <li
                    key={fc.id}
                    className="flex items-start gap-2 text-body-sm text-text-secondary"
                  >
                    <span className="text-text-tertiary mt-0.5 shrink-0">
                      &bull;
                    </span>
                    {fc.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
