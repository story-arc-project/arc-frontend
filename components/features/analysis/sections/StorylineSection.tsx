import type { Storyline } from "@/types/analysis";
import { Badge } from "@/components/ui";

interface StorylineSectionProps {
  title?: string;
  storylines: Storyline[];
}

const FLOW_STEPS: { key: keyof Pick<Storyline, "start" | "development" | "evidence" | "growth" | "arrival">; label: string }[] = [
  { key: "start", label: "시작" },
  { key: "development", label: "전개" },
  { key: "evidence", label: "증거" },
  { key: "growth", label: "성장" },
  { key: "arrival", label: "도착점" },
];

export default function StorylineSection({
  title = "종합 스토리라인",
  storylines,
}: StorylineSectionProps) {
  if (storylines.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">{title}</h3>

      {storylines.map((sl) => (
        <div
          key={sl.id}
          className="bg-surface border border-border rounded-lg p-4 space-y-4"
        >
          {/* Flow */}
          <div className="relative pl-4 space-y-4">
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
            {FLOW_STEPS.map((step) => (
              <div key={step.key} className="relative flex gap-3 items-start">
                <div className="w-2.5 h-2.5 rounded-full bg-brand border-2 border-surface shrink-0 mt-1 z-10" />
                <div>
                  <p className="text-caption text-text-tertiary font-medium mb-0.5">
                    {step.label}
                  </p>
                  <p className="text-body-sm text-text-secondary leading-relaxed">
                    {sl[step.key]}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Experience tags */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {sl.coreExperienceIds.map((id) => (
              <Badge key={id} variant="brand">
                핵심: {id}
              </Badge>
            ))}
            {sl.supportingExperienceIds.map((id) => (
              <Badge key={id} variant="default">
                보조: {id}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
