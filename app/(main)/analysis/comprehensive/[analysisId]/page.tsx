"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import type {
  ComprehensiveAnalysisResult,
  ComprehensiveWeakness,
  ContentQualityIssue,
  CriticalDiagnosis,
  JobRecommendation,
  KeywordClustering,
  SynergyCombination,
  WeaknessSeverity,
} from "@/types/analysis";
import { weaknessSeverityLabel } from "@/types/analysis";
import { getComprehensiveResult } from "@/lib/api/analysis-api";
import { isSafeHttpUrl } from "@/lib/utils/url-utils";
import { useBasePath } from "@/lib/utils/use-base-path";
import { Badge } from "@/components/ui";

export default function ComprehensiveDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const basePath = useBasePath();
  const [data, setData] = useState<ComprehensiveAnalysisResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getComprehensiveResult(analysisId)
      .then(setData)
      .catch(() => setError(true));
  }, [analysisId]);

  if (error) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-16" role="alert">
          <p className="text-body text-text-secondary mb-3">
            분석 결과를 불러오지 못했습니다.
          </p>
          <Link
            href={`${basePath}/analysis/comprehensive`}
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

  const userTitle = [data.userSchool, data.userDepartment].filter(Boolean).join(" · ");

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href={`${basePath}/analysis/comprehensive`}
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <header className="space-y-2">
          <h1 className="text-heading-2 text-text-primary">종합 분석 결과</h1>
          {userTitle && <p className="text-body-sm text-text-tertiary">{userTitle}</p>}
        </header>

        {data.missingInfoWarning && (
          <div
            role="status"
            className="flex gap-2 items-start p-4 rounded-lg bg-surface-warning text-warning"
          >
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p className="text-body-sm leading-relaxed">{data.missingInfoWarning}</p>
          </div>
        )}

        <hr className="border-border" />

        <SummaryBlock brief={data.briefSummary} detailed={data.detailedSummary} />

        <KeywordClusteringBlock clustering={data.keywordClustering} />

        <ExperienceInsightsBlock insights={data.experienceInsights} />

        <SynergyCombinationsBlock combinations={data.synergyCombinations} />

        <ResumeStarBlock items={data.resumeStarFormat} />

        <AdditionalRecommendationsBlock additional={data.additionalRecommendations} />

        <CriticalDiagnosisBlock diagnosis={data.criticalDiagnosis} />

        <ActionPlanBlock plan={data.actionPlan} />

        <JobRecommendationsBlock items={data.validJobRecommendations} />
      </div>
    </main>
  );
}

function SummaryBlock({ brief, detailed }: { brief: string; detailed: string }) {
  if (!brief && !detailed) return null;
  return (
    <section className="space-y-4">
      {brief && (
        <div className="space-y-2">
          <h2 className="text-title text-text-primary">한눈에 보기</h2>
          <div className="bg-surface-secondary rounded-lg p-4">
            <p className="text-body text-text-secondary leading-relaxed whitespace-pre-line">
              {brief}
            </p>
          </div>
        </div>
      )}
      {detailed && (
        <div className="space-y-2">
          <h2 className="text-title text-text-primary">상세 요약</h2>
          <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {detailed}
          </p>
        </div>
      )}
    </section>
  );
}

function KeywordClusteringBlock({ clustering }: { clustering: KeywordClustering }) {
  const groups: { label: string; items: string[] }[] = [
    { label: "성향", items: clustering.personalityTendency },
    { label: "핵심 역량", items: clustering.coreCompetency },
    { label: "직무·산업", items: clustering.jobIndustry },
  ].filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">키워드 클러스터링</h2>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.label} className="space-y-2">
            <p className="text-label text-text-tertiary">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((it) => (
                <Badge key={it} variant="brand">{it}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExperienceInsightsBlock({
  insights,
}: {
  insights: ComprehensiveAnalysisResult["experienceInsights"];
}) {
  if (!insights.motivation && !insights.learningPoints) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">경험 인사이트</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.motivation && (
          <InfoBlock label="동기 / 지향" body={insights.motivation} />
        )}
        {insights.learningPoints && (
          <InfoBlock label="학습 포인트" body={insights.learningPoints} />
        )}
      </div>
    </section>
  );
}

function SynergyCombinationsBlock({ combinations }: { combinations: SynergyCombination[] }) {
  if (combinations.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">시너지 조합</h2>
      <ul className="space-y-3">
        {combinations.map((c, i) => (
          <li
            key={`${c.combinationTitle}-${i}`}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            <h3 className="text-body font-medium text-text-primary">{c.combinationTitle}</h3>
            {c.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {c.items.map((it) => (
                  <Badge key={it} variant="default">{it}</Badge>
                ))}
              </div>
            )}
            {c.synergyReason && <Field label="시너지 이유" value={c.synergyReason} />}
            {c.expectedEffect && <Field label="기대 효과" value={c.expectedEffect} />}
            {c.applicableRoles.length > 0 && (
              <div className="space-y-1">
                <p className="text-caption text-text-tertiary font-medium">적합 직무</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.applicableRoles.map((r) => (
                    <Badge key={r} variant="outline">{r}</Badge>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResumeStarBlock({
  items,
}: {
  items: ComprehensiveAnalysisResult["resumeStarFormat"];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">자소서용 STAR</h2>
      <div className="space-y-4">
        {items.map((star, i) => {
          const fields = [
            { label: "S · 상황", value: star.situation },
            { label: "T · 과제", value: star.task },
            { label: "A · 행동", value: star.action },
            { label: "R · 결과", value: star.result },
          ];
          return (
            <article
              key={`${star.title}-${i}`}
              className="bg-surface border border-border rounded-lg p-4 space-y-3"
            >
              {star.title && (
                <h3 className="text-body-sm font-medium text-text-primary">{star.title}</h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fields.map((f) => (
                  <div key={f.label}>
                    <p className="text-caption text-text-tertiary font-medium mb-1">
                      {f.label}
                    </p>
                    <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
                      {f.value || (
                        <span className="text-error font-medium">보완 필요</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AdditionalRecommendationsBlock({
  additional,
}: {
  additional: ComprehensiveAnalysisResult["additionalRecommendations"];
}) {
  const groups: { label: string; items: string[] }[] = [
    { label: "추천 자격증", items: additional.certifications },
    { label: "추천 동아리/모임", items: additional.clubsAndSocieties },
    { label: "추천 프로젝트/공모전", items: additional.projectsAndContests },
  ].filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">추가 활동 추천</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {groups.map((g) => (
          <div key={g.label} className="bg-surface border border-border rounded-lg p-4 space-y-2">
            <p className="text-label text-brand font-medium">{g.label}</p>
            <ul className="space-y-1">
              {g.items.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 items-start text-body-sm text-text-secondary"
                >
                  <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const severityVariant: Record<WeaknessSeverity, "error" | "warning" | "default"> = {
  high: "error",
  medium: "warning",
  low: "default",
};

function CriticalDiagnosisBlock({ diagnosis }: { diagnosis: CriticalDiagnosis }) {
  const empty =
    !diagnosis.oneLineVerdict &&
    !diagnosis.competitorGap &&
    diagnosis.weaknesses.length === 0 &&
    diagnosis.missingExperienceTypes.length === 0 &&
    diagnosis.contentQualityIssues.length === 0;
  if (empty) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">크리티컬 진단</h2>

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

      {diagnosis.missingExperienceTypes.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">부족한 경험 유형</p>
          <div className="flex flex-wrap gap-1.5">
            {diagnosis.missingExperienceTypes.map((t) => (
              <Badge key={t} variant="warning">{t}</Badge>
            ))}
          </div>
        </div>
      )}

      {diagnosis.contentQualityIssues.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">콘텐츠 품질 이슈</p>
          <ul className="space-y-2">
            {diagnosis.contentQualityIssues.map((q, i) => (
              <ContentQualityCard key={i} issue={q} />
            ))}
          </ul>
        </div>
      )}

      {diagnosis.competitorGap && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">경쟁자 대비 갭</p>
          <div className="bg-surface-secondary rounded-lg p-4">
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {diagnosis.competitorGap}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function WeaknessCard({ weakness }: { weakness: ComprehensiveWeakness }) {
  return (
    <li className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={severityVariant[weakness.severity]}>
          {weaknessSeverityLabel[weakness.severity]}
        </Badge>
        {weakness.category && <Badge variant="outline">{weakness.category}</Badge>}
        <h3 className="text-body-sm font-medium text-text-primary">{weakness.title}</h3>
      </div>
      {weakness.diagnosis && <Field label="진단" value={weakness.diagnosis} />}
      {weakness.evidence && <Field label="근거" value={weakness.evidence} />}
      {weakness.impact && <Field label="영향" value={weakness.impact} />}
      {weakness.priorityAction && (
        <Field label="우선 조치" value={weakness.priorityAction} />
      )}
    </li>
  );
}

function ContentQualityCard({ issue }: { issue: ContentQualityIssue }) {
  return (
    <li className="bg-surface border border-border rounded-lg p-3 space-y-1.5">
      {issue.item && (
        <p className="text-body-sm font-medium text-text-primary">{issue.item}</p>
      )}
      {issue.issue && (
        <p className="text-body-sm text-text-secondary leading-relaxed">{issue.issue}</p>
      )}
      {issue.improvementHint && (
        <p className="text-caption text-brand leading-relaxed">→ {issue.improvementHint}</p>
      )}
    </li>
  );
}

function ActionPlanBlock({
  plan,
}: {
  plan: ComprehensiveAnalysisResult["actionPlan"];
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

function JobRecommendationsBlock({ items }: { items: JobRecommendation[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">유효 채용 공고</h2>
      <ul className="space-y-3">
        {items.map((j, i) => (
          <li
            key={`${j.company}-${j.role}-${i}`}
            className="bg-surface border border-border rounded-lg p-4 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-body-sm font-medium text-text-primary">
                {j.company} · {j.role}
              </h3>
              {j.deadline && (
                <Badge variant="warning">마감 {j.deadline}</Badge>
              )}
            </div>
            {j.whyMatch && <Field label="추천 이유" value={j.whyMatch} />}
            {j.url && isSafeHttpUrl(j.url) && (
              <a
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-caption text-brand font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
              >
                공고 보기 <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
          </li>
        ))}
      </ul>
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
