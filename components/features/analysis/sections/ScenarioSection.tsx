import type { Scenario } from "@/types/analysis";
import { Badge } from "@/components/ui";

interface ScenarioSectionProps {
  scenarios: Scenario[];
}

export default function ScenarioSection({ scenarios }: ScenarioSectionProps) {
  if (scenarios.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">시나리오별 스토리라인</h3>

      <div className="space-y-4">
        {scenarios.map((sc) => (
          <div
            key={sc.id}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            <h4 className="text-body text-text-primary font-medium">
              {sc.title}
            </h4>

            <p className="text-body-sm text-text-secondary leading-relaxed">
              {sc.rationale}
            </p>

            {/* Emphasis points */}
            <div>
              <p className="text-caption text-text-tertiary font-medium mb-1.5">
                강조 포인트
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sc.emphasisPoints.map((point, i) => (
                  <Badge key={i} variant="brand">
                    {point}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Speaking order */}
            <div>
              <p className="text-caption text-text-tertiary font-medium mb-1.5">
                말하기 순서
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {sc.speakingOrder.map((step, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <span className="text-text-tertiary">&rarr;</span>
                    )}
                    <span className="text-body-sm text-text-secondary">
                      {step}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Fit comment */}
            {sc.fitComment && (
              <div className="bg-surface-secondary rounded-md p-3">
                <p className="text-body-sm text-text-secondary italic leading-relaxed">
                  {sc.fitComment}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
