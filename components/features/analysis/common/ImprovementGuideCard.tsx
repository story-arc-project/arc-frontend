import { AlertCircle } from "lucide-react";
import type { ImprovementGuide } from "@/types/analysis";

interface ImprovementGuideCardProps {
  guide: ImprovementGuide;
  className?: string;
}

export default function ImprovementGuideCard({ guide, className = "" }: ImprovementGuideCardProps) {
  return (
    <div
      className={[
        "bg-surface border border-border rounded-lg p-4",
        className,
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle size={16} className="text-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-body-sm text-text-primary leading-relaxed">
            {guide.reason}
          </p>
          <p className="text-body-sm text-text-secondary mt-1.5 leading-relaxed">
            {guide.suggestion}
          </p>
          {guide.targetField && (
            <p className="text-caption text-brand mt-2 font-medium">
              &rarr; {guide.targetField} 보완
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
