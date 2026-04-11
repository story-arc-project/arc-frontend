import type { Connection } from "@/types/analysis";
import { connectionTypeLabel } from "@/types/analysis";
import { Badge } from "@/components/ui";
import EvidenceQuote from "../common/EvidenceQuote";
import ImprovementGuideCard from "../common/ImprovementGuideCard";

interface ConnectionStructureSectionProps {
  connections: Connection[];
}

const strengthLabel: Record<string, string> = {
  strong: "강함",
  moderate: "보통",
  weak: "약함",
};

const strengthStyle: Record<string, string> = {
  strong: "bg-surface-success text-success",
  moderate: "bg-surface-warning text-warning",
  weak: "bg-surface-error text-error",
};

export default function ConnectionStructureSection({
  connections,
}: ConnectionStructureSectionProps) {
  if (connections.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">경험 간 연결 구조</h3>

      <div className="space-y-4">
        {connections.map((conn, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            {/* Connection pair */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-body-sm text-text-primary font-medium">
                {conn.fromTitle}
              </span>
              <span className="text-text-tertiary">&rarr;</span>
              <span className="text-body-sm text-text-primary font-medium">
                {conn.toTitle}
              </span>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {connectionTypeLabel[conn.connectionType]}
              </Badge>
              <span
                className={[
                  "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium leading-none",
                  strengthStyle[conn.strength],
                ].join(" ")}
              >
                {strengthLabel[conn.strength]}
              </span>
            </div>

            {/* Evidence */}
            <EvidenceQuote evidence={conn.evidence} />

            {/* Improvement guide for weak connections */}
            {conn.improvementGuide && (
              <ImprovementGuideCard guide={conn.improvementGuide} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
