import type { ActivityRecommendation } from "@/types/analysis";
import EvidenceQuote from "./EvidenceQuote";

interface ActivityRecommendCardProps {
  recommendation: ActivityRecommendation;
  className?: string;
}

export default function ActivityRecommendCard({
  recommendation,
  className = "",
}: ActivityRecommendCardProps) {
  return (
    <div
      className={[
        "bg-surface border border-border rounded-lg p-4 space-y-3",
        className,
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <h4 className="text-body-sm text-text-primary font-medium flex-1 leading-snug">
          {recommendation.activity}
        </h4>
        <span
          className={[
            "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium leading-none",
            recommendation.type === "expand"
              ? "bg-surface-brand text-brand"
              : "bg-surface-success text-success",
          ].join(" ")}
        >
          {recommendation.type === "expand" ? "확장" : "보완"}
        </span>
      </div>

      {/* Reason */}
      <p className="text-body-sm text-text-secondary leading-relaxed">
        {recommendation.reason}
      </p>

      {/* Evidence */}
      <EvidenceQuote evidence={recommendation.evidence} />

      {/* Expected effect */}
      <p className="text-caption text-text-tertiary">
        기대 효과: {recommendation.expectedEffect}
      </p>

      {/* Scenario link */}
      {recommendation.scenarioId && (
        <p className="text-caption text-brand font-medium">
          시나리오 연결됨
        </p>
      )}
    </div>
  );
}
