import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RelatedExperience } from "@/types/analysis";
import { connectionTypeLabel } from "@/types/analysis";
import { Badge } from "@/components/ui";

interface RelatedExperienceSectionProps {
  experiences: RelatedExperience[];
}

export default function RelatedExperienceSection({
  experiences,
}: RelatedExperienceSectionProps) {
  if (experiences.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">함께 보면 좋은 경험</h3>
      <div className="space-y-3">
        {experiences.map((exp) => (
          <Link
            key={exp.experienceId}
            href={`/analysis/individual/${exp.experienceId}`}
            className="block bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-body-sm text-text-primary font-medium">
                {exp.title}
              </span>
              <Badge variant="outline">
                {connectionTypeLabel[exp.connectionType]}
              </Badge>
            </div>
            <p className="text-body-sm text-text-secondary leading-relaxed">
              {exp.reason}
            </p>
            <span className="inline-flex items-center gap-1 mt-2 text-caption text-brand font-medium">
              분석 보기 <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
