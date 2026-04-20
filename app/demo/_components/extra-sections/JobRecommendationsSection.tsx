import { Briefcase, Calendar } from "lucide-react";

interface JobRecommendation {
  company: string;
  role: string;
  deadline: string;
  whyMatch: string;
  url?: string | null;
}

interface JobRecommendationsSectionProps {
  recommendations: JobRecommendation[];
}

export default function JobRecommendationsSection({
  recommendations,
}: JobRecommendationsSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">유효 채용 공고 추천</h2>

      <div className="space-y-2">
        {recommendations.map((r, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start gap-3"
          >
            <div className="shrink-0 w-9 h-9 rounded-md bg-surface-brand text-brand flex items-center justify-center">
              <Briefcase size={16} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-body text-text-primary font-medium">{r.company}</h3>
                <span className="text-caption text-text-tertiary">·</span>
                <span className="text-body-sm text-text-secondary">{r.role}</span>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">{r.whyMatch}</p>
              <div className="flex items-center gap-1.5 text-caption text-text-tertiary">
                <Calendar size={12} aria-hidden="true" />
                마감: {r.deadline}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
