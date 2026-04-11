import { ConfidenceLevel, confidenceLevelLabel } from "@/types/analysis";

const styles: Record<ConfidenceLevel, string> = {
  sufficient: "bg-surface-success text-success",
  partial: "bg-surface-warning text-warning",
  insufficient: "bg-surface-error text-error",
};

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  className?: string;
}

export default function ConfidenceBadge({ confidence, className = "" }: ConfidenceBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium leading-none",
        styles[confidence],
        className,
      ].join(" ")}
    >
      {confidenceLevelLabel[confidence]}
    </span>
  );
}
