import type { KeywordFitEvaluation } from "@/types/analysis";
import EvidenceQuote from "../common/EvidenceQuote";

interface KeywordFitSectionProps {
  evaluations: KeywordFitEvaluation[];
}

const AXIS_LABELS: Record<string, string> = {
  specificity: "구체성",
  actionClarity: "행동 선명함",
  impactStrength: "임팩트 강도",
  consistency: "반복성·일관성",
};

function GaugeBar({ value, max = 25, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="h-full bg-brand rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-caption text-text-tertiary w-8 text-right shrink-0">
        {value}/{max}
      </span>
    </div>
  );
}

export default function KeywordFitSection({
  evaluations,
}: KeywordFitSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">키워드 적합도 평가</h3>

      <div className="space-y-4">
        {evaluations.map((ev) => (
          <div
            key={ev.keywordId}
            className="bg-surface border border-border rounded-lg p-4 space-y-4"
          >
            {/* Header with score */}
            <div className="flex items-center gap-3">
              <span className="text-heading-2 text-brand font-bold leading-none">
                {ev.totalScore}
              </span>
              <div>
                <p className="text-body text-text-primary font-medium">
                  {ev.label}
                </p>
                <p className="text-caption text-text-tertiary">총점 (0~100)</p>
              </div>
            </div>

            {/* 4-axis gauges */}
            <div className="space-y-2">
              {(
                Object.entries(ev.axes) as [string, number][]
              ).map(([key, value]) => (
                <div key={key}>
                  <p className="text-caption text-text-tertiary mb-1">
                    {AXIS_LABELS[key] ?? key}
                  </p>
                  <GaugeBar value={value} label={AXIS_LABELS[key] ?? key} />
                </div>
              ))}
            </div>

            {/* Strong evidences */}
            {ev.strongEvidences.length > 0 && (
              <div>
                <p className="text-caption text-success font-medium mb-2">
                  강한 증거
                </p>
                <div className="space-y-2">
                  {ev.strongEvidences.map((e, i) => (
                    <EvidenceQuote key={i} evidence={e} />
                  ))}
                </div>
              </div>
            )}

            {/* Weak evidences */}
            {ev.weakEvidences.length > 0 && (
              <div>
                <p className="text-caption text-warning font-medium mb-2">
                  약한 증거
                </p>
                <div className="space-y-2">
                  {ev.weakEvidences.map((e, i) => (
                    <EvidenceQuote key={i} evidence={e} />
                  ))}
                </div>
              </div>
            )}

            {/* Missing evidences */}
            {ev.missingEvidences.length > 0 && (
              <div>
                <p className="text-caption text-error font-medium mb-2">
                  빈 증거
                </p>
                <ul className="space-y-1">
                  {ev.missingEvidences.map((m, i) => (
                    <li
                      key={i}
                      className="text-body-sm text-text-secondary flex items-start gap-2"
                    >
                      <span className="text-error mt-0.5 shrink-0">&bull;</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
