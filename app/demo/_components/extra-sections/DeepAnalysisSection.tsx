import { Sparkles, TrendingUp, AlertCircle, Target, Gauge } from "lucide-react";

interface DeepAnalysisSectionProps {
  careerValue: string;
  strengths: string[];
  limitations: string[];
  applicableRoles: string[];
  marketValue: string;
}

export default function DeepAnalysisSection({
  careerValue,
  strengths,
  limitations,
  applicableRoles,
  marketValue,
}: DeepAnalysisSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">심층 분석</h2>

      <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-start gap-2">
          <Sparkles size={16} className="text-brand mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-label text-text-tertiary">커리어 가치</p>
            <p className="text-body-sm text-text-secondary leading-relaxed mt-1">{careerValue}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-surface-secondary rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={14} className="text-success" aria-hidden="true" />
              <p className="text-label text-text-secondary">강점</p>
            </div>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="text-body-sm text-text-primary leading-relaxed">
                  · {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface-secondary rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle size={14} className="text-warning" aria-hidden="true" />
              <p className="text-label text-text-secondary">한계</p>
            </div>
            <ul className="space-y-1.5">
              {limitations.map((l, i) => (
                <li key={i} className="text-body-sm text-text-primary leading-relaxed">
                  · {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Target size={16} className="text-brand mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-label text-text-tertiary">어필 가능한 직무</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {applicableRoles.map((role) => (
                <span
                  key={role}
                  className="bg-surface-brand text-brand-dark rounded-full px-2.5 py-0.5 text-caption font-medium"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Gauge size={16} className="text-text-secondary mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-label text-text-tertiary">시장 가치</p>
            <p className="text-body-sm text-text-secondary leading-relaxed mt-1">{marketValue}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
