"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react";
import type {
  IndividualAnalysisResult,
  IndividualWeakness,
  IndividualStrength,
  IndividualStrengthLevel,
  WeaknessSeverity,
  SynergyPriority,
} from "@/types/analysis";
import {
  weaknessSeverityLabel,
  synergyPriorityLabel,
  individualStrengthLevelLabel,
} from "@/types/analysis";
import { getIndividualAnalysisResult, UnsupportedSchemaError } from "@/lib/api/analysis-api";
import { useBasePath } from "@/lib/utils/use-base-path";
import { Badge } from "@/components/ui"
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import UnsupportedSchemaNotice from "@/components/features/analysis/common/UnsupportedSchemaNotice";
import AnalysisResultUnavailable from "@/components/features/analysis/common/AnalysisResultUnavailable";

export default function IndividualAnalysisDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const basePath = useBasePath();
  const [data, setData] = useState<IndividualAnalysisResult | null>(null);
  const [error, setError] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    let active = true;
    getIndividualAnalysisResult(analysisId)
      .then((d) => {
        if (!active) return;
        setError(false);
        setUnsupported(false);
        setData(d);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof UnsupportedSchemaError) {
          setUnsupported(true);
          setError(false);
        } else {
          setError(true);
          setUnsupported(false);
        }
      });
    return () => {
      active = false;
    };
  }, [analysisId]);

  if (unsupported) {
    return <UnsupportedSchemaNotice basePath={basePath} fallbackHref="/analysis/individual" />;
  }

  if (error) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-16" role="alert">
          <p className="text-body text-text-secondary mb-3">
            분석 결과를 불러오지 못했습니다.
          </p>
          <Link
            href={basePath ? `${basePath}/analysis` : "/analysis/individual"}
            className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-6" aria-busy="true">
          <div className="h-4 w-20 bg-surface-secondary rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-3/5 bg-surface-secondary rounded animate-pulse" />
            <div className="h-4 w-2/5 bg-surface-tertiary rounded animate-pulse" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-secondary rounded-lg animate-pulse p-4 space-y-3">
              <div className="h-5 w-2/5 bg-surface-tertiary rounded" />
              <div className="h-3 w-full bg-surface-tertiary rounded" />
              <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  // 본문이 안 왔으면 헤더만 남은 빈 화면 대신 상태 안내로 전환한다(FRT-134).
  // 개별 분석은 재시도 엔드포인트가 없어 다시 시도 버튼을 붙이지 않는다.
  if (!data.hasResultBody) {
    return (
      <AnalysisResultUnavailable
        status={data.status}
        basePath={basePath}
        fallbackHref="/analysis/individual"
        analysisId={analysisId}
      />
    );
  }

  const { result } = data;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href={basePath ? `${basePath}/analysis` : "/analysis/individual"}
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <div className="flex items-start justify-between gap-3">
          <header className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-heading-2 text-text-primary">{result.itemName || "이력 분석"}</h1>
              {result.itemType && <Badge variant="brand">{result.itemType}</Badge>}
            </div>
            {data.experienceId && (
              <Link
                href={`${basePath}/archive?id=${data.experienceId}`}
                className="inline-flex items-center gap-1 text-caption text-brand font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
              >
                아카이브에서 보기 <ExternalLink size={12} aria-hidden="true" />
              </Link>
            )}
          </header>
          <BookmarkToggle analysisId={analysisId} isBookmarked={data.isBookmarked} />
        </div>

        {result.missingInfoWarning && (
          <div
            role="status"
            className="flex gap-2 items-start p-4 rounded-lg bg-surface-warning text-warning"
          >
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p className="text-body-sm leading-relaxed">{result.missingInfoWarning}</p>
          </div>
        )}

        <hr className="border-border" />

        {result.briefSummary && (
          <section className="space-y-3">
            <h2 className="text-title text-text-primary">한눈에 보기</h2>
            <div className="bg-surface-secondary rounded-lg p-4">
              <p className="text-body text-text-secondary leading-relaxed whitespace-pre-line">
                {result.briefSummary}
              </p>
            </div>
          </section>
        )}

        <DeepAnalysisSection deep={result.deepAnalysis} />

        <StarFormatSection star={result.starFormat} />

        {/* 강점 → 진단(약점) 순서. 백엔드 프롬프트의 앵커링 저항 원칙과 같은 배치이며,
            종합분석 상세도 strength_diagnosis 를 critical_diagnosis 앞에 둔다. */}
        <ItemStrengthsSection strengths={result.itemStrengths} />

        <ItemDiagnosisSection diagnosis={result.itemDiagnosis} />

        <SynergySection items={result.synergyRecommendations} />

        <ActionPlanSection plan={result.actionPlan} />
      </div>
    </main>
  );
}

function DeepAnalysisSection({
  deep,
}: {
  deep: IndividualAnalysisResult["result"]["deepAnalysis"];
}) {
  const hasAny =
    deep.careerValue || deep.marketValue || deep.applicableRoles.length > 0;
  if (!hasAny) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">심층 분석</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {deep.careerValue && (
          <InfoBlock label="커리어 가치" body={deep.careerValue} />
        )}
        {deep.marketValue && (
          <InfoBlock label="시장 가치" body={deep.marketValue} />
        )}
      </div>
      {deep.applicableRoles.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">적합한 직무</p>
          <div className="flex flex-wrap gap-2">
            {deep.applicableRoles.map((role) => (
              <Badge key={role} variant="outline">
                {role}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StarFormatSection({
  star,
}: {
  star: IndividualAnalysisResult["result"]["starFormat"];
}) {
  const fields = [
    { label: "S · 상황", value: star.situation },
    { label: "T · 과제", value: star.task },
    { label: "A · 행동", value: star.action },
    { label: "R · 결과", value: star.result },
  ];
  if (!star.title && fields.every((f) => !f.value)) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">STAR 정리</h2>
      {star.title && (
        <p className="text-body-sm font-medium text-text-primary">{star.title}</p>
      )}
      <div className="bg-surface border border-border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-caption text-text-tertiary font-medium mb-1">{f.label}</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {f.value || <span className="text-error font-medium">보완 필요</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// 개별분석 전용 등급 표 — 종합분석의 strengthLevelVariant 와 어휘가 달라 공유하지 않는다
// (개별: outstanding|notable|moderate / 종합: outstanding|strong|notable).
const individualStrengthLevelVariant: Record<
  IndividualStrengthLevel,
  "brand" | "success" | "default"
> = {
  outstanding: "brand",
  notable: "success",
  moderate: "default",
};

function ItemStrengthsSection({
  strengths,
}: {
  strengths: IndividualAnalysisResult["result"]["itemStrengths"];
}) {
  const hasCards = strengths.strengths.length > 0;
  // hasGenuineStrengths 는 판정에 넣지 않는다 — 방어 파싱의 기본값(false)이 아니라
  // "서술이 하나라도 왔는가"로 그려야 구 레코드에서 빈 껍데기 섹션이 뜨지 않는다.
  const empty =
    !hasCards &&
    !strengths.oneLineVerdict &&
    !strengths.noStrengthReason &&
    !strengths.strongestAsset &&
    !strengths.positioningTip &&
    strengths.summarizedStrengths.length === 0;
  if (empty) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">강점</h2>

      {strengths.oneLineVerdict && (
        <div className="bg-surface-brand text-brand-dark rounded-lg p-4">
          <p className="text-body-sm font-medium leading-relaxed">
            {strengths.oneLineVerdict}
          </p>
        </div>
      )}

      {strengths.summarizedStrengths.length > 0 && (
        <BulletBlock label="한눈에" items={strengths.summarizedStrengths} tone="success" />
      )}

      {hasCards && (
        <ul className="space-y-3">
          {strengths.strengths.map((s) => (
            <StrengthCard key={s.id} strength={s} />
          ))}
        </ul>
      )}

      {/* 강점이 없을 때만 사유를 안내한다 — 빈 섹션 대신 다음 행동이 보이게(제품 원칙). */}
      {!hasCards && strengths.noStrengthReason && (
        <InfoBlock label="지금 상태" body={strengths.noStrengthReason} />
      )}

      {strengths.strongestAsset && (
        <InfoBlock label="가장 강한 자산" body={strengths.strongestAsset} />
      )}

      {strengths.positioningTip && (
        <InfoBlock label="이렇게 내세우세요" body={strengths.positioningTip} />
      )}
    </section>
  );
}

function StrengthCard({ strength }: { strength: IndividualStrength }) {
  return (
    <li className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={individualStrengthLevelVariant[strength.level]}>
          {individualStrengthLevelLabel[strength.level]}
        </Badge>
        {strength.category && <Badge variant="outline">{strength.category}</Badge>}
        <h3 className="text-body-sm font-medium text-text-primary">{strength.title}</h3>
      </div>
      {strength.analysis && <Field label="분석" value={strength.analysis} />}
      {strength.evidence && <Field label="근거" value={strength.evidence} />}
      {strength.careerImpact && <Field label="영향" value={strength.careerImpact} />}
      {strength.leverageAction && <Field label="활용 방법" value={strength.leverageAction} />}
      {strength.showcaseExample && (
        <Field label="표현 예시" value={strength.showcaseExample} />
      )}
    </li>
  );
}

const severityVariant: Record<WeaknessSeverity, "error" | "warning" | "default"> = {
  critical: "error",
  major: "warning",
  minor: "default",
};

function ItemDiagnosisSection({
  diagnosis,
}: {
  diagnosis: IndividualAnalysisResult["result"]["itemDiagnosis"];
}) {
  const empty =
    !diagnosis.oneLineVerdict &&
    !diagnosis.rewriteSuggestion &&
    diagnosis.weaknesses.length === 0 &&
    diagnosis.limitations.length === 0 &&
    diagnosis.missingElements.length === 0;
  if (empty) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">진단 결과</h2>

      {diagnosis.oneLineVerdict && (
        <div className="bg-surface-brand text-brand-dark rounded-lg p-4">
          <p className="text-body-sm font-medium leading-relaxed">{diagnosis.oneLineVerdict}</p>
        </div>
      )}

      {diagnosis.weaknesses.length > 0 && (
        <div className="space-y-3">
          <p className="text-label text-text-tertiary">약점</p>
          <ul className="space-y-3">
            {diagnosis.weaknesses.map((w) => (
              <WeaknessCard key={w.id} weakness={w} />
            ))}
          </ul>
        </div>
      )}

      {/* 백엔드는 한계를 item_diagnosis 안에 둔다 — 약점 카드보다 가벼운 서술이라 뒤에 붙인다. */}
      {diagnosis.limitations.length > 0 && (
        <BulletBlock label="한계" items={diagnosis.limitations} tone="warning" />
      )}

      {diagnosis.missingElements.length > 0 && (
        <BulletBlock label="누락된 요소" items={diagnosis.missingElements} tone="warning" />
      )}

      {diagnosis.rewriteSuggestion && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">리라이트 제안</p>
          <div className="bg-surface-secondary rounded-lg p-4">
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {diagnosis.rewriteSuggestion}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function WeaknessCard({ weakness }: { weakness: IndividualWeakness }) {
  return (
    <li className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={severityVariant[weakness.severity]}>
          {weaknessSeverityLabel[weakness.severity]}
        </Badge>
        {weakness.category && <Badge variant="outline">{weakness.category}</Badge>}
        <h3 className="text-body-sm font-medium text-text-primary">{weakness.title}</h3>
      </div>
      {weakness.diagnosis && (
        <Field label="진단" value={weakness.diagnosis} />
      )}
      {weakness.evidence && <Field label="근거" value={weakness.evidence} />}
      {weakness.impact && <Field label="영향" value={weakness.impact} />}
      {weakness.priorityAction && (
        <Field label="우선 조치" value={weakness.priorityAction} />
      )}
      {weakness.improvementExample && (
        <Field label="개선 예시" value={weakness.improvementExample} />
      )}
    </li>
  );
}

const priorityVariant: Record<SynergyPriority, "brand" | "default" | "outline"> = {
  high: "brand",
  medium: "default",
  low: "outline",
};

function SynergySection({
  items,
}: {
  items: IndividualAnalysisResult["result"]["synergyRecommendations"];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">시너지 추천 활동</h2>
      <ul className="space-y-3">
        {items.map((s, i) => (
          <li
            key={`${s.name}-${i}`}
            className="bg-surface border border-border rounded-lg p-4 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={priorityVariant[s.priority]}>
                {synergyPriorityLabel[s.priority]}
              </Badge>
              {s.category && <Badge variant="outline">{s.category}</Badge>}
              <h3 className="text-body-sm font-medium text-text-primary">{s.name}</h3>
            </div>
            {s.reason && <Field label="추천 이유" value={s.reason} />}
            {s.expectedEffect && <Field label="기대 효과" value={s.expectedEffect} />}
            {s.estimatedDuration && (
              <p className="text-caption text-text-tertiary">예상 기간: {s.estimatedDuration}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionPlanSection({
  plan,
}: {
  plan: IndividualAnalysisResult["result"]["actionPlan"];
}) {
  const buckets: { label: string; value: string }[] = [
    { label: "단기", value: plan.shortTerm },
    { label: "중기", value: plan.midTerm },
    { label: "장기", value: plan.longTerm },
  ].filter((b) => b.value);
  if (buckets.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">액션 플랜</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {buckets.map((b) => (
          <div key={b.label} className="bg-surface border border-border rounded-lg p-4 space-y-2">
            <p className="text-label text-brand font-medium">{b.label}</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {b.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="bg-surface-secondary rounded-lg p-4 space-y-1">
      <p className="text-label text-text-tertiary font-medium">{label}</p>
      <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}

function BulletBlock({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "success" | "warning";
}) {
  const dot = tone === "success" ? "bg-success" : "bg-warning";
  return (
    <div className="space-y-2">
      <p className="text-label text-text-tertiary">{label}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 items-start text-body-sm text-text-secondary">
            <span className={`mt-2 inline-block w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-text-tertiary font-medium mb-0.5">{label}</p>
      <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
        {value}
      </p>
    </div>
  );
}
