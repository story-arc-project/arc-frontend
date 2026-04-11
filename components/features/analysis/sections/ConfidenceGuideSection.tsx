import type { ConfidenceLevel, ImprovementGuide } from "@/types/analysis";
import ConfidenceBadge from "../common/ConfidenceBadge";
import ImprovementGuideCard from "../common/ImprovementGuideCard";

interface ConfidenceGuideSectionProps {
  confidence: ConfidenceLevel;
  guides: ImprovementGuide[];
}

export default function ConfidenceGuideSection({
  confidence,
  guides,
}: ConfidenceGuideSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">
        판단 근거 · 확신도 · 보완 가이드
      </h3>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-body-sm text-text-secondary">전체 확신도</span>
        <ConfidenceBadge confidence={confidence} />
      </div>

      {guides.length > 0 && (
        <div className="space-y-2">
          {guides.map((g, i) => (
            <ImprovementGuideCard key={i} guide={g} />
          ))}
        </div>
      )}
    </section>
  );
}
