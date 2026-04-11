import type { StarSummary, ImprovementGuide } from "@/types/analysis";
import ImprovementGuideCard from "../common/ImprovementGuideCard";

interface StarSummarySectionProps {
  summaries: StarSummary[];
  guides: ImprovementGuide[];
}

function FieldCell({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing: boolean;
}) {
  return (
    <div>
      <p className="text-caption text-text-tertiary font-medium mb-1">
        {label}
      </p>
      {missing ? (
        <p className="text-body-sm text-error font-medium">보완 필요</p>
      ) : (
        <p className="text-body-sm text-text-secondary leading-relaxed">
          {value}
        </p>
      )}
    </div>
  );
}

export default function StarSummarySection({
  summaries,
  guides,
}: StarSummarySectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">STAR 요약</h3>

      <div className="space-y-4">
        {summaries.map((star, idx) => {
          const fields = [
            { key: "situation", label: "Situation", value: star.situation },
            { key: "task", label: "Task", value: star.task },
            { key: "action", label: "Action", value: star.action },
            { key: "result", label: "Result", value: star.result },
          ];
          const isComplete = star.missingFields.length === 0;

          return (
            <div
              key={star.incidentId}
              className="bg-surface border border-border rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-body-sm text-text-primary font-medium">
                  사건 {idx + 1}
                </span>
                {isComplete ? (
                  <span className="text-caption text-success font-medium">
                    완결
                  </span>
                ) : (
                  <span className="text-caption text-error font-medium">
                    미완결
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fields.map((f) => (
                  <FieldCell
                    key={f.key}
                    label={f.label}
                    value={f.value}
                    missing={star.missingFields.includes(f.key)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {guides.length > 0 && (
        <div className="space-y-2 mt-4">
          <p className="text-label text-text-tertiary">보완 가이드</p>
          {guides.map((g, i) => (
            <ImprovementGuideCard key={i} guide={g} />
          ))}
        </div>
      )}
    </section>
  );
}
