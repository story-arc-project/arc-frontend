interface Weakness {
  id: number;
  category: string;
  severity: "critical" | "major" | "minor";
  title: string;
  diagnosis: string;
  evidence: string;
  impact: string;
  priorityAction: string;
  improvementExample?: string;
}

interface ItemDiagnosisSectionProps {
  oneLineVerdict: string;
  weaknesses: Weakness[];
  missingElements: string[];
  rewriteSuggestion: string;
}

const severityLabel: Record<Weakness["severity"], string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
};

const severityClass: Record<Weakness["severity"], string> = {
  critical: "bg-error/10 text-error border border-error/20",
  major: "bg-warning/10 text-warning border border-warning/20",
  minor: "bg-surface-secondary text-text-secondary border border-border",
};

export default function ItemDiagnosisSection({
  oneLineVerdict,
  weaknesses,
  missingElements,
  rewriteSuggestion,
}: ItemDiagnosisSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">냉정 진단</h2>

      <div className="bg-surface border border-border rounded-lg p-4 space-y-5">
        <div className="bg-surface-secondary rounded-md p-3">
          <p className="text-label text-text-tertiary mb-1">한 줄 진단</p>
          <p className="text-body text-text-primary leading-relaxed">{oneLineVerdict}</p>
        </div>

        <div className="space-y-3">
          <p className="text-label text-text-secondary">약점</p>
          {weaknesses.map((w) => (
            <div key={w.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-caption font-medium rounded px-1.5 py-0.5 ${severityClass[w.severity]}`}>
                  {severityLabel[w.severity]}
                </span>
                <span className="text-caption text-text-tertiary">{w.category.replace(/_/g, " ")}</span>
                <h3 className="text-body-sm text-text-primary font-medium">{w.title}</h3>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">{w.diagnosis}</p>
              <div className="bg-surface-secondary rounded px-2 py-1.5">
                <p className="text-caption text-text-tertiary">근거</p>
                <p className="text-body-sm text-text-primary mt-0.5">&ldquo;{w.evidence}&rdquo;</p>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                <span className="text-text-tertiary">영향:</span> {w.impact}
              </p>
              <p className="text-body-sm text-brand-dark leading-relaxed">
                <span className="text-text-tertiary">우선 실행:</span> {w.priorityAction}
              </p>
              {w.improvementExample && (
                <div className="bg-surface-brand rounded px-2 py-1.5">
                  <p className="text-caption text-brand-dark">개선 예시</p>
                  <p className="text-body-sm text-text-primary mt-0.5">{w.improvementExample}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {missingElements.length > 0 && (
          <div>
            <p className="text-label text-text-secondary mb-2">누락 요소</p>
            <div className="flex flex-wrap gap-1.5">
              {missingElements.map((m, i) => (
                <span
                  key={i}
                  className="bg-surface-secondary text-text-secondary rounded-full px-2.5 py-0.5 text-caption"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-surface-brand rounded-md p-3">
          <p className="text-label text-brand-dark mb-1">이력서 표현 전략</p>
          <p className="text-body-sm text-text-primary leading-relaxed">{rewriteSuggestion}</p>
        </div>
      </div>
    </section>
  );
}
