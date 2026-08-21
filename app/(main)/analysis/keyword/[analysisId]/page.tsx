"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  KeywordAnalysisResult,
  KeywordCoverage,
  KeywordDefinition,
  KeywordImprovementGuide,
  KeywordMatchedGroup,
  KeywordStoryline,
  MatchedExperience,
  ImprovementOverallDirection,
} from "@/types/analysis";
import { getKeywordResult, UnsupportedSchemaError } from "@/lib/api/analysis-api";
import { formatDateTime } from "@/lib/utils/date-utils";
import { useAnalysisViewed } from "@/lib/analytics";
import { useBasePath } from "@/lib/utils/use-base-path";
import { isAnalysisRetryEnabled } from "@/lib/analysis/flags";
import { Badge } from "@/components/ui";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import UnsupportedSchemaNotice from "@/components/features/analysis/common/UnsupportedSchemaNotice";
import AnalysisResultUnavailable from "@/components/features/analysis/common/AnalysisResultUnavailable";

export default function KeywordDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const basePath = useBasePath();
  const [data, setData] = useState<KeywordAnalysisResult | null>(null);
  const [error, setError] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    // 클라이언트 이동으로 analysisId 가 바뀌면 이전 결과의 unsupported/error 플래그가
    // 눌러붙지 않도록 성공·실패 두 경로 모두에서 상태를 정리한다. active 가드로 경합도 막는다.
    let active = true;
    getKeywordResult(analysisId)
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

  // 이 결과를 얼마나 봤는가(FRT-107). 결과가 화면에 실제로 있는 동안만 잰다.
  useAnalysisViewed({ analysisType: "keyword", analysisId, ready: !!data });

  if (unsupported) {
    return <UnsupportedSchemaNotice basePath={basePath} fallbackHref="/analysis/keyword" />;
  }

  if (error) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-16" role="alert">
          <p className="text-body text-text-secondary mb-3">
            분석 결과를 불러오지 못했습니다.
          </p>
          <Link
            href={basePath ? `${basePath}/analysis` : "/analysis/keyword"}
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
            <div className="flex gap-1.5">
              <div className="h-6 w-16 bg-surface-tertiary rounded-full animate-pulse" />
              <div className="h-6 w-20 bg-surface-tertiary rounded-full animate-pulse" />
            </div>
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

  // 본문(A~F)이 안 왔으면 헤더와 키워드 배지만 남은 빈 화면 대신 상태 안내로 전환한다(FRT-134).
  if (!data.hasResultBody) {
    return (
      <AnalysisResultUnavailable
        status={data.status}
        basePath={basePath}
        fallbackHref="/analysis/keyword"
        analysisId={analysisId}
        analysisType="keyword"
        canRetry={isAnalysisRetryEnabled()}
        onRetried={() =>
          setData((prev) => (prev ? { ...prev, status: "processing" } : prev))
        }
      />
    );
  }

  const headerTitle = data.keywords.length > 0
    ? `'${data.keywords.join(" · ")}' 키워드 분석`
    : "키워드 분석";

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href={basePath ? `${basePath}/analysis` : "/analysis/keyword"}
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <div className="flex items-start justify-between gap-3">
          <header className="space-y-2 flex-1 min-w-0">
            <h1 className="text-heading-2 text-text-primary">{headerTitle}</h1>
            {data.analysisDate && (
              <p className="text-body-sm text-text-tertiary">
                분석 시점: {formatDateTime(data.analysisDate)}
              </p>
            )}
            {data.keywords.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {data.keywords.map((kw) => (
                  <Badge key={kw} variant="brand">{kw}</Badge>
                ))}
              </div>
            )}
            {data.targetScenario && (
              <p className="text-body-sm text-text-secondary">
                타겟 시나리오: <span className="text-text-primary">{data.targetScenario}</span>
              </p>
            )}
          </header>
          <BookmarkToggle analysisId={analysisId} isBookmarked={data.isBookmarked} />
        </div>

        <hr className="border-border" />

        <KeywordDefinitionsBlock definitions={data.keywordDefinitions} />

        <SelectionCriteriaBlock criteria={data.selectionCriteria} />

        <CoverageBlock coverage={data.coverage} />

        <MatchedExperiencesBlock
          groups={data.matchedExperiences}
          definitions={data.keywordDefinitions}
        />

        <StorylinesBlock storylines={data.storylines} />

        <ImprovementGuideBlock guide={data.improvementGuide} />
      </div>
    </main>
  );
}

function KeywordDefinitionsBlock({ definitions }: { definitions: KeywordDefinition[] }) {
  if (definitions.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">키워드 정의</h2>
      <ul className="space-y-3">
        {definitions.map((d) => (
          <li
            key={d.keyword}
            className="bg-surface border border-border rounded-lg p-4 space-y-3"
          >
            <h3 className="text-body font-medium text-text-primary">{d.keyword}</h3>
            {d.definition && (
              <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {d.definition}
              </p>
            )}
            {d.synonyms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {d.synonyms.map((s) => (
                  <Badge key={s} variant="default">{s}</Badge>
                ))}
              </div>
            )}
            {d.complianceCriteria.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-caption text-text-tertiary font-medium">부합 기준</p>
                <ul className="space-y-1.5">
                  {d.complianceCriteria.map((c) => (
                    <li
                      key={c.id}
                      className="flex gap-2 items-start text-body-sm text-text-secondary"
                    >
                      <span className="text-caption text-text-tertiary font-medium shrink-0 mt-0.5 tabular-nums">
                        {c.id}.
                      </span>
                      <span className="leading-relaxed">
                        {c.criterion}
                        {c.signalDescription && (
                          <span className="block text-caption text-text-tertiary mt-0.5">
                            신호: {c.signalDescription}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SelectionCriteriaBlock({
  criteria,
}: {
  criteria: KeywordAnalysisResult["selectionCriteria"];
}) {
  if (!criteria.summary && criteria.criteria.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">경험 선별 기준</h2>
      {criteria.summary && (
        <div className="bg-surface-secondary rounded-lg p-4">
          <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {criteria.summary}
          </p>
        </div>
      )}
      {criteria.criteria.length > 0 && (
        <ul className="space-y-1.5">
          {criteria.criteria.map((c, i) => (
            <li
              key={i}
              className="flex gap-2 items-start text-body-sm text-text-secondary"
            >
              <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
              <span className="leading-relaxed">{c}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CoverageBlock({ coverage }: { coverage: KeywordCoverage[] }) {
  if (coverage.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">커버리지</h2>
      <div className="space-y-3">
        {coverage.map((c) => {
          const pct = Math.max(0, Math.min(100, Math.round(c.coveragePercent)));
          return (
            <div
              key={c.keyword}
              className="bg-surface border border-border rounded-lg p-4 space-y-2"
            >
              <div className="flex justify-between items-center">
                <p className="text-body-sm font-medium text-text-primary">{c.keyword}</p>
                <p className="text-caption text-text-tertiary">
                  {c.relatedCount}/{c.totalCount} · {pct}%
                </p>
              </div>
              <div
                className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden"
                role="progressbar"
                aria-label={`${c.keyword} 커버리지`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {(c.highCount > 0 || c.mediumCount > 0 || c.lowCount > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {c.highCount > 0 && (
                    <Badge variant="success">높음 {c.highCount}</Badge>
                  )}
                  {c.mediumCount > 0 && (
                    <Badge variant="warning">보통 {c.mediumCount}</Badge>
                  )}
                  {c.lowCount > 0 && (
                    <Badge variant="default">참고 {c.lowCount}</Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MatchedExperiencesBlock({
  groups,
  definitions,
}: {
  groups: KeywordMatchedGroup[];
  definitions: KeywordDefinition[];
}) {
  if (groups.length === 0) return null;
  // matched_criteria(number[]) 를 같은 키워드의 compliance_criteria(id→문장) 와 조인한다(v4.1 명세).
  const criteriaByKeyword = new Map<string, Map<number, string>>();
  for (const d of definitions) {
    criteriaByKeyword.set(
      d.keyword,
      new Map(d.complianceCriteria.map((c) => [c.id, c.criterion])),
    );
  }
  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">매칭된 경험</h2>
      <div className="space-y-6">
        {groups.map((g) => {
          const criteria = criteriaByKeyword.get(g.keyword) ?? new Map<number, string>();
          return (
            <div key={g.keyword} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="brand">{g.keyword}</Badge>
                <p className="text-caption text-text-tertiary">{g.experiences.length}개 경험</p>
              </div>
              <ul className="space-y-3">
                {g.experiences.map((exp, i) => (
                  <ExperienceCard
                    key={`${g.keyword}-${i}`}
                    experience={exp}
                    criteria={criteria}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const relevanceMeta: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
  high: { label: "높음", variant: "success" },
  medium: { label: "보통", variant: "warning" },
  low: { label: "참고", variant: "default" },
};

function ExperienceCard({
  experience,
  criteria,
}: {
  experience: MatchedExperience;
  criteria: Map<number, string>;
}) {
  const rel = relevanceMeta[experience.relevance.toLowerCase()];
  // relevanceSummary(v4.1)가 있으면 그것을, 없고 relevance 가 enum 밖 자유텍스트(구버전)면
  // 원본 문자열을 본문으로 보여 준다 — 연관성 정보가 조용히 사라지지 않게.
  const relevanceText =
    experience.relevanceSummary || (!rel ? experience.relevance : "");
  return (
    <li className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-body-sm font-medium text-text-primary">
            {experience.careerTitle || "이력 정보 없음"}
          </h3>
          {rel && <Badge variant={rel.variant}>연관성 {rel.label}</Badge>}
          {experience.isReferenceOnly && <Badge variant="outline">참고용</Badge>}
        </div>
        <p className="text-caption text-text-tertiary">
          {[experience.organization, experience.period].filter(Boolean).join(" · ")}
        </p>
      </div>
      {relevanceText && (
        <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
          {relevanceText}
        </p>
      )}
      {experience.confidence && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={confidenceVariant(experience.confidence)}>
            확신도: {experience.confidence}
          </Badge>
          {experience.confidenceReason && (
            <p className="text-caption text-text-tertiary">{experience.confidenceReason}</p>
          )}
        </div>
      )}
      {experience.matchedCriteria.length > 0 && (
        <div className="space-y-1">
          <p className="text-caption text-text-tertiary font-medium">충족 기준</p>
          <div className="flex flex-wrap gap-1.5">
            {experience.matchedCriteria.map((c, i) => (
              <Badge key={i} variant="outline">
                {typeof c === "number" ? (criteria.get(c) ?? `기준 ${c}`) : c}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {experience.evidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption text-text-tertiary font-medium">근거</p>
          <ul className="space-y-2">
            {experience.evidence.map((e, i) => (
              <li
                key={i}
                className="bg-surface-secondary rounded-md p-3 space-y-1.5"
              >
                {e.type && (
                  <Badge variant="default" className="!text-[11px]">
                    {e.type}
                  </Badge>
                )}
                {e.content && (
                  <p className="text-body-sm text-text-secondary leading-relaxed">{e.content}</p>
                )}
                {e.sourceQuote && (
                  <blockquote className="border-l-2 border-border pl-2 text-caption text-text-tertiary italic leading-relaxed">
                    “{e.sourceQuote}”
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function confidenceVariant(value: string): "success" | "warning" | "default" {
  const lower = value.toLowerCase();
  if (lower.includes("high") || lower.includes("높")) return "success";
  if (lower.includes("medium") || lower.includes("중") || lower.includes("보통")) return "warning";
  return "default";
}

function StorylinesBlock({ storylines }: { storylines: KeywordStoryline[] }) {
  if (storylines.length === 0) return null;
  const flow: { key: keyof KeywordStoryline["structure"]; label: string }[] = [
    { key: "start", label: "시작" },
    { key: "development", label: "전개" },
    { key: "evidence", label: "증거" },
    { key: "growth", label: "성장" },
    { key: "destination", label: "도착점" },
  ];
  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">키워드 기반 스토리라인</h2>
      {storylines.map((sl, idx) => (
        <article
          key={`${sl.keyword}-${idx}`}
          className="bg-surface border border-border rounded-lg p-4 space-y-4"
        >
          <header className="space-y-1">
            <Badge variant="brand">{sl.keyword}</Badge>
            {sl.storylineTitle && (
              <h3 className="text-body font-medium text-text-primary">{sl.storylineTitle}</h3>
            )}
            {sl.tagline && (
              <p className="text-body-sm text-brand-dark">“{sl.tagline}”</p>
            )}
          </header>

          {sl.narrative && (
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {sl.narrative}
            </p>
          )}

          {sl.chronologicalSequence.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-caption text-text-tertiary font-medium">시간순 흐름</p>
                {sl.timelineStatus && (
                  <Badge variant="default" className="!text-[11px]">
                    {sl.timelineStatus.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <ol className="space-y-1">
                {sl.chronologicalSequence.map((c) => (
                  <li key={c.order} className="flex gap-2 text-body-sm text-text-secondary">
                    <span className="text-text-tertiary shrink-0 tabular-nums">
                      {c.period || "시기 미상"}
                    </span>
                    <span className="leading-relaxed">
                      {c.experience}
                      {!c.isDated && (
                        <span className="text-caption text-text-tertiary"> (시점 추정)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              {sl.timelineNote && (
                <p className="text-caption text-text-tertiary leading-relaxed">{sl.timelineNote}</p>
              )}
            </div>
          )}

          <div className="relative pl-4 space-y-4">
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
            {flow.map((step) => {
              const value = sl.structure[step.key];
              if (!value) return null;
              return (
                <div key={step.key} className="relative flex gap-3 items-start">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand border-2 border-surface shrink-0 mt-1 z-10" />
                  <div>
                    <p className="text-caption text-text-tertiary font-medium mb-0.5">
                      {step.label}
                    </p>
                    <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
                      {value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {sl.turningPoints.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-caption text-text-tertiary font-medium">전환점</p>
              <ul className="space-y-2">
                {sl.turningPoints.map((t, i) => (
                  <li key={i} className="bg-surface-secondary rounded-md p-3 space-y-1">
                    <p className="text-body-sm font-medium text-text-primary">
                      {t.experience}
                      {t.period && (
                        <span className="text-caption text-text-tertiary font-normal"> · {t.period}</span>
                      )}
                    </p>
                    {t.trigger && (
                      <p className="text-body-sm text-text-secondary leading-relaxed">계기: {t.trigger}</p>
                    )}
                    {t.whatChanged && (
                      <p className="text-body-sm text-text-secondary leading-relaxed">변화: {t.whatChanged}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sl.connectiveLogic.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-caption text-text-tertiary font-medium">경험 연결</p>
              <ul className="space-y-2">
                {sl.connectiveLogic.map((c, i) => (
                  <li key={i} className="text-body-sm text-text-secondary">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-text-primary font-medium">{c.fromExperience}</span>
                      <span className="text-text-tertiary" aria-hidden="true">→</span>
                      <span className="text-text-primary font-medium">{c.toExperience}</span>
                      {c.relationType && (
                        <Badge variant="default" className="!text-[11px]">{c.relationType}</Badge>
                      )}
                    </span>
                    {c.connection && (
                      <span className="block text-caption text-text-tertiary mt-0.5 leading-relaxed">
                        {c.connection}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(sl.usedExperiences.core.length > 0 || sl.usedExperiences.supporting.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {sl.usedExperiences.core.map((id) => (
                <Badge key={`core-${id}`} variant="brand">핵심: {id}</Badge>
              ))}
              {sl.usedExperiences.supporting.map((id) => (
                <Badge key={`sup-${id}`} variant="default">보조: {id}</Badge>
              ))}
            </div>
          )}

          {sl.keyQuotes.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-caption text-text-tertiary font-medium">핵심 인용</p>
              <ul className="space-y-1.5">
                {sl.keyQuotes.map((q, i) => (
                  <li key={i}>
                    <blockquote className="border-l-2 border-brand pl-3 text-body-sm text-text-secondary italic leading-relaxed">
                      “{q.quote}”
                      {q.careerTitle && (
                        <span className="block not-italic text-caption text-text-tertiary mt-0.5">
                          — {q.careerTitle}
                        </span>
                      )}
                    </blockquote>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function priorityVariant(priority: string): "error" | "warning" | "default" {
  if (priority.includes("높")) return "error";
  if (priority.includes("중")) return "warning";
  return "default";
}

function OverallDirectionBlock({ direction }: { direction: ImprovementOverallDirection }) {
  const rows = [
    { label: "현재 프로필", value: direction.currentProfileSummary },
    { label: "단기 방향", value: direction.shortTerm },
    { label: "중기 방향", value: direction.midTerm },
  ].filter((r) => r.value);
  return (
    <div className="bg-surface-brand rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-label text-brand-dark font-medium">종합 방향</p>
        {direction.priorityKeyword && (
          <Badge variant="brand">우선: {direction.priorityKeyword}</Badge>
        )}
      </div>
      {rows.map((r) => (
        <div key={r.label}>
          <p className="text-caption text-text-tertiary font-medium mb-0.5">{r.label}</p>
          <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {r.value}
          </p>
        </div>
      ))}
      {direction.priorityReason && (
        <p className="text-caption text-text-tertiary leading-relaxed">
          {direction.priorityReason}
        </p>
      )}
    </div>
  );
}

function ImprovementGuideBlock({ guide }: { guide: KeywordImprovementGuide }) {
  const empty =
    !guide.overallDirection &&
    guide.informationEnhancement.length === 0 &&
    guide.experienceExpansion.length === 0 &&
    guide.keywordSpecificRecommendations.length === 0;
  if (empty) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">보완 가이드</h2>

      {guide.overallDirection && (
        <OverallDirectionBlock direction={guide.overallDirection} />
      )}

      {guide.informationEnhancement.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">정보 보강</p>
          <ul className="space-y-2">
            {guide.informationEnhancement.map((e, i) => (
              <li key={i} className="bg-surface border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {e.priority && <Badge variant={priorityVariant(e.priority)}>{e.priority}</Badge>}
                  {e.target && (
                    <span className="text-body-sm font-medium text-text-primary">{e.target}</span>
                  )}
                </div>
                {e.missing && <p className="text-body-sm text-text-secondary leading-relaxed">부족: {e.missing}</p>}
                {e.howToAdd && <p className="text-body-sm text-text-secondary leading-relaxed">보강: {e.howToAdd}</p>}
                {e.reason && <p className="text-caption text-text-tertiary leading-relaxed">{e.reason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {guide.experienceExpansion.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">경험 확장</p>
          <ul className="space-y-2">
            {guide.experienceExpansion.map((e, i) => (
              <li key={i} className="bg-surface border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {e.priority && <Badge variant={priorityVariant(e.priority)}>{e.priority}</Badge>}
                  {e.suggestedExperienceType && (
                    <span className="text-body-sm font-medium text-text-primary">
                      {e.suggestedExperienceType}
                    </span>
                  )}
                </div>
                {e.gapDescription && <p className="text-body-sm text-text-secondary leading-relaxed">공백: {e.gapDescription}</p>}
                {e.whyHelpful && <p className="text-body-sm text-text-secondary leading-relaxed">도움: {e.whyHelpful}</p>}
                {e.examples.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {e.examples.map((ex, j) => (
                      <Badge key={j} variant="outline">{ex}</Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {guide.keywordSpecificRecommendations.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">키워드별 추천</p>
          <ul className="space-y-2">
            {guide.keywordSpecificRecommendations.map((r, i) => (
              <li key={i} className="bg-surface border border-border rounded-lg p-3 space-y-2">
                {r.keyword && <Badge variant="brand">{r.keyword}</Badge>}
                {r.recommendations.length > 0 && (
                  <ul className="space-y-1.5">
                    {r.recommendations.map((rec, j) => (
                      <li key={j} className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rec.type && (
                            <Badge variant="default" className="!text-[11px]">{rec.type}</Badge>
                          )}
                          {rec.title && (
                            <span className="text-body-sm text-text-primary">{rec.title}</span>
                          )}
                        </div>
                        {rec.expectedEffect && (
                          <p className="text-caption text-text-tertiary leading-relaxed">
                            {rec.expectedEffect}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
