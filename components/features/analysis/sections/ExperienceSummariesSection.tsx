import type { ExperienceSummaryCard } from "@/types/analysis";
import { Badge } from "@/components/ui";

interface ExperienceSummariesSectionProps {
  summaries: ExperienceSummaryCard[];
}

export default function ExperienceSummariesSection({
  summaries,
}: ExperienceSummariesSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">선택 경험 요약</h3>

      <div className="space-y-3">
        {summaries.map((exp) => (
          <div
            key={exp.experienceId}
            className="bg-surface border border-border rounded-lg p-4"
          >
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-body-sm text-text-primary font-medium">
                {exp.title}
              </span>
              <Badge
                variant={exp.role === "primary" ? "brand" : "default"}
              >
                {exp.role === "primary" ? "핵심" : "보조"}
              </Badge>
              <span className="text-caption text-text-tertiary">
                중요도 {exp.importance}/5
              </span>
            </div>
            <p className="text-body-sm text-text-secondary leading-relaxed mb-1">
              {exp.summary}
            </p>
            <p className="text-caption text-brand font-medium">
              {exp.highlight}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
