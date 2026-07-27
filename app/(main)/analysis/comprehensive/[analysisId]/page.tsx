"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import type {
  Certification,
  ClubSociety,
  ComprehensiveAnalysisResult,
  ComprehensiveWeakness,
  ContentQualityHighlight,
  ContentQualityIssue,
  CriticalDiagnosis,
  JobRecommendation,
  KeywordClustering,
  ProjectContest,
  Strength,
  StrengthDiagnosis,
  StrengthLevel,
  SynergyCombination,
  WeaknessSeverity,
} from "@/types/analysis";
import { strengthLevelLabel, weaknessSeverityLabel } from "@/types/analysis";
import { getComprehensiveResult, UnsupportedSchemaError } from "@/lib/api/analysis-api";
import { isSafeHttpUrl } from "@/lib/utils/url-utils";
import { useBasePath } from "@/lib/utils/use-base-path";
import { Badge } from "@/components/ui";
import { isAnalysisRetryEnabled } from "@/lib/analysis/flags";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import UnsupportedSchemaNotice from "@/components/features/analysis/common/UnsupportedSchemaNotice";
import AnalysisResultUnavailable from "@/components/features/analysis/common/AnalysisResultUnavailable";

export default function ComprehensiveDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const basePath = useBasePath();
  const [data, setData] = useState<ComprehensiveAnalysisResult | null>(null);
  const [error, setError] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    let active = true;
    getComprehensiveResult(analysisId)
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
    return <UnsupportedSchemaNotice basePath={basePath} fallbackHref="/analysis/comprehensive" />;
  }

  if (error) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-16" role="alert">
          <p className="text-body text-text-secondary mb-3">
            분석 결과를 불러오지 못했습니다.
          </p>
          <Link
            href={basePath ? `${basePath}/analysis` : "/analysis/comprehensive"}
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

  // 본문이 안 왔으면 헤더와 경험 배지만 남은 빈 화면 대신 상태 안내로 전환한다(FRT-134).
  if (!data.hasResultBody) {
    return (
      <AnalysisResultUnavailable
        status={data.status}
        basePath={basePath}
        fallbackHref="/analysis/comprehensive"
        analysisId={analysisId}
        analysisType="comprehensive"
        canRetry={isAnalysisRetryEnabled()}
        onRetried={() =>
          setData((prev) => (prev ? { ...prev, status: "processing" } : prev))
        }
      />
    );
  }

  const userTitle = [data.userSchool, data.userDepartment].filter(Boolean).join(" · ");

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href={basePath ? `${basePath}/analysis` : "/analysis/comprehensive"}
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <div className="flex items-start justify-between gap-3">
          <header className="space-y-2 flex-1 min-w-0">
            <h1 className="text-heading-2 text-text-primary">종합 분석 결과</h1>
            {userTitle && <p className="text-body-sm text-text-tertiary">{userTitle}</p>}
          </header>
          <BookmarkToggle analysisId={analysisId} isBookmarked={data.isBookmarked} />
        </div>

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

        <ExperiencesBlock experiences={data.experiences} />

        <SummaryBlock brief={data.briefSummary} detailed={data.detailedSummary} />

        <KeywordClusteringBlock clustering={data.keywordClustering} />

        <ExperienceInsightsBlock insights={data.experienceInsights} />

        <SynergyCombinationsBlock combinations={data.synergyCombinations} />

        <ResumeStarBlock items={data.resumeStarFormat} />

        <AdditionalRecommendationsBlock additional={data.additionalRecommendations} />

        <StrengthDiagnosisBlock diagnosis={data.strengthDiagnosis} />

        <CriticalDiagnosisBlock diagnosis={data.criticalDiagnosis} />

        <ActionPlanBlock plan={data.actionPlan} />

        <JobRecommendationsBlock verified={data.verifiedJobs} expired={data.expiredJobs} />
      </div>
    </main>
  );
}

function ExperiencesBlock({
  experiences,
}: {
  experiences: ComprehensiveAnalysisResult["experiences"];
}) {
  if (experiences.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-title text-text-primary">포함된 경험 {experiences.length}개</h2>
      <div className="flex flex-wrap gap-1.5">
        {experiences.map((exp, i) =>
          // 계약: title === null 만 "삭제된 경험". 빈 문자열은 제목 없는 실제 경험이므로
          // 삭제로 오표시하지 않고 제목 폴백을 쓴다(레거시 빈 제목 레코드 지원).
          exp.title === null ? (
            // 삭제된 경험은 id 가 빈 문자열일 수 있어 인덱스로 키 충돌을 막는다.
            <Badge key={exp.id || `deleted-${i}`} variant="default" className="text-text-tertiary italic">
              삭제된 경험
            </Badge>
          ) : (
            <Badge key={exp.id || `exp-${i}`} variant="outline">
              {exp.title || "제목 없음"}
            </Badge>
          ),
        )}
      </div>
    </section>
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

// 추천 항목 링크 — url 이 있고 안전한 http(s) 일 때만 "공식 페이지" 링크를 건다.
function RecommendationLink({ url }: { url: string | null }) {
  if (!url || !isSafeHttpUrl(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-caption text-brand font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
    >
      공식 페이지 <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

function RecommendationCard({
  title,
  metas,
  description,
  reason,
  expectedEffect,
  url,
}: {
  title: string;
  metas?: string[];
  /** 동아리·학회의 `description`(그 단체가 무엇을 하는지)은 추천 이유와 다른 정보다 — 같이 보여준다. */
  description?: string;
  reason: string;
  expectedEffect: string;
  url: string | null;
}) {
  const shownMetas = (metas ?? []).filter(Boolean);
  return (
    <li className="bg-surface border border-border rounded-lg p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="text-body-sm font-medium text-text-primary">{title}</h3>
        {shownMetas.map((m) => (
          <Badge key={m} variant="outline">
            {m}
          </Badge>
        ))}
      </div>
      {description && <Field label="활동 내용" value={description} />}
      {reason && <Field label="추천 이유" value={reason} />}
      {expectedEffect && <Field label="기대 효과" value={expectedEffect} />}
      <RecommendationLink url={url} />
    </li>
  );
}

function AdditionalRecommendationsBlock({
  additional,
}: {
  additional: ComprehensiveAnalysisResult["additionalRecommendations"];
}) {
  const { certifications, clubsAndSocieties, projectsAndContests } = additional;
  const empty =
    certifications.length === 0 &&
    clubsAndSocieties.length === 0 &&
    projectsAndContests.length === 0;
  if (empty) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">추가 활동 추천</h2>

      {certifications.length > 0 && (
        <RecommendationGroup label="추천 자격증">
          {certifications.map((c: Certification, i) => (
            <RecommendationCard
              key={`${c.name}-${i}`}
              title={c.name}
              metas={[c.issuer, c.estimatedDuration].filter(Boolean)}
              reason={c.reason}
              expectedEffect={c.expectedEffect}
              url={c.url}
            />
          ))}
        </RecommendationGroup>
      )}

      {clubsAndSocieties.length > 0 && (
        <RecommendationGroup label="추천 동아리/학회">
          {clubsAndSocieties.map((c: ClubSociety, i) => (
            <RecommendationCard
              key={`${c.name}-${i}`}
              title={c.name}
              metas={[c.type, c.schoolAffiliation].filter(Boolean)}
              description={c.description}
              reason={c.reason}
              expectedEffect={c.expectedEffect}
              url={c.url}
            />
          ))}
        </RecommendationGroup>
      )}

      {projectsAndContests.length > 0 && (
        <RecommendationGroup label="추천 프로젝트/공모전">
          {projectsAndContests.map((p: ProjectContest, i) => (
            <RecommendationCard
              key={`${p.name}-${i}`}
              title={p.name}
              metas={[
                p.organizer,
                p.deadline ? `마감 ${p.deadline}` : "",
                p.isRegular ? "정기 개최" : "",
              ].filter(Boolean)}
              reason={p.reason}
              expectedEffect={p.expectedEffect}
              url={p.url}
            />
          ))}
        </RecommendationGroup>
      )}
    </section>
  );
}

function RecommendationGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-label text-text-tertiary">{label}</p>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

const severityVariant: Record<WeaknessSeverity, "error" | "warning" | "default"> = {
  critical: "error",
  major: "warning",
  minor: "default",
};

const strengthLevelVariant: Record<StrengthLevel, "brand" | "success" | "default"> = {
  outstanding: "brand",
  strong: "success",
  notable: "default",
};

// 강점 진단 — 계약/프롬프트상 critical_diagnosis 보다 먼저 노출한다(앵커링 저항).
function StrengthDiagnosisBlock({ diagnosis }: { diagnosis: StrengthDiagnosis }) {
  const hasStrengths = diagnosis.strengths.length > 0;
  const empty =
    !diagnosis.oneLineVerdict &&
    !diagnosis.competitorAdvantage &&
    !hasStrengths &&
    diagnosis.standoutExperienceTypes.length === 0 &&
    diagnosis.contentQualityHighlights.length === 0 &&
    !diagnosis.noStrengthDiagnosis.reason &&
    !diagnosis.noStrengthDiagnosis.improvementDirection;
  if (empty) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">강점 진단</h2>

      {diagnosis.oneLineVerdict && (
        <div className="bg-surface-brand text-brand-dark rounded-lg p-4">
          <p className="text-body-sm font-medium leading-relaxed">{diagnosis.oneLineVerdict}</p>
        </div>
      )}

      {hasStrengths && (
        <div className="space-y-3">
          <p className="text-label text-text-tertiary">강점</p>
          <ul className="space-y-3">
            {diagnosis.strengths.map((s) => (
              <StrengthCard key={s.id} strength={s} />
            ))}
          </ul>
        </div>
      )}

      {/* 강점이 없을 때만 사유·개선 방향을 안내한다(솔직한 빈 상태). */}
      {!hasStrengths && (diagnosis.noStrengthDiagnosis.reason ||
        diagnosis.noStrengthDiagnosis.improvementDirection) && (
        <div className="space-y-2">
          {diagnosis.noStrengthDiagnosis.reason && (
            <InfoBlock label="현재 상태" body={diagnosis.noStrengthDiagnosis.reason} />
          )}
          {diagnosis.noStrengthDiagnosis.improvementDirection && (
            <InfoBlock
              label="강점을 만드는 방향"
              body={diagnosis.noStrengthDiagnosis.improvementDirection}
            />
          )}
        </div>
      )}

      {diagnosis.standoutExperienceTypes.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">돋보이는 경험 유형</p>
          <div className="flex flex-wrap gap-1.5">
            {diagnosis.standoutExperienceTypes.map((t) => (
              <Badge key={t} variant="success">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {diagnosis.contentQualityHighlights.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">잘 작성된 항목</p>
          <ul className="space-y-2">
            {diagnosis.contentQualityHighlights.map((h, i) => (
              <ContentQualityHighlightCard key={i} highlight={h} />
            ))}
          </ul>
        </div>
      )}

      {diagnosis.competitorAdvantage && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">차별점</p>
          <div className="bg-surface-secondary rounded-lg p-4">
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {diagnosis.competitorAdvantage}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function StrengthCard({ strength }: { strength: Strength }) {
  return (
    <li className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={strengthLevelVariant[strength.level]}>
          {strengthLevelLabel[strength.level]}
        </Badge>
        {strength.category && <Badge variant="outline">{strength.category}</Badge>}
        <h3 className="text-body-sm font-medium text-text-primary">{strength.title}</h3>
      </div>
      {strength.diagnosis && <Field label="진단" value={strength.diagnosis} />}
      {strength.evidence && <Field label="근거" value={strength.evidence} />}
      {strength.impact && <Field label="영향" value={strength.impact} />}
      {strength.leverageAction && <Field label="활용 방법" value={strength.leverageAction} />}
    </li>
  );
}

function ContentQualityHighlightCard({ highlight }: { highlight: ContentQualityHighlight }) {
  return (
    <li className="bg-surface border border-border rounded-lg p-3 space-y-1.5">
      {highlight.item && (
        <p className="text-body-sm font-medium text-text-primary">{highlight.item}</p>
      )}
      {highlight.highlight && (
        <p className="text-body-sm text-text-secondary leading-relaxed">{highlight.highlight}</p>
      )}
      {highlight.whyEffective && (
        <p className="text-caption text-brand leading-relaxed">→ {highlight.whyEffective}</p>
      )}
    </li>
  );
}

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
      <h2 className="text-title text-text-primary">보완 포인트</h2>

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
          <p className="text-label text-text-tertiary">개선 여지</p>
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

function JobCard({ job, dimmed }: { job: JobRecommendation; dimmed?: boolean }) {
  return (
    <li
      className={`bg-surface border border-border rounded-lg p-4 space-y-2 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body-sm font-medium text-text-primary">
          {job.company} · {job.role}
        </h3>
        {job.deadline && (
          <Badge variant={dimmed ? "default" : "warning"}>
            {dimmed ? "마감됨" : "마감"} {job.deadline}
          </Badge>
        )}
      </div>
      {job.whyMatch && <Field label="추천 이유" value={job.whyMatch} />}
      {job.url && isSafeHttpUrl(job.url) && (
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-caption text-brand font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          공고 보기 <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </li>
  );
}

function JobRecommendationsBlock({
  verified,
  expired,
}: {
  verified: JobRecommendation[];
  expired: JobRecommendation[];
}) {
  if (verified.length === 0 && expired.length === 0) return null;
  return (
    <section className="space-y-3">
      {/* 섹션 제목은 중립으로 둔다 — 유효 공고가 0건이고 마감 공고만 남는 경우가 흔해서
          "유효 채용 공고" 아래 마감 공고만 깔리는 오표기를 만들지 않는다. */}
      <h2 className="text-title text-text-primary">채용 공고</h2>
      {verified.length > 0 && (
        <div className="space-y-2">
          {expired.length > 0 && <p className="text-label text-text-tertiary">유효 공고</p>}
          <ul className="space-y-3">
            {verified.map((j, i) => (
              <JobCard key={`v-${j.company}-${j.role}-${i}`} job={j} />
            ))}
          </ul>
        </div>
      )}
      {/* 마감 지난 공고는 약화 표기로 별도 노출한다(백엔드가 굳이 분리해 보낸 정보 보존). */}
      {expired.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">마감된 공고</p>
          <ul className="space-y-3">
            {expired.map((j, i) => (
              <JobCard key={`e-${j.company}-${j.role}-${i}`} job={j} dimmed />
            ))}
          </ul>
        </div>
      )}
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
