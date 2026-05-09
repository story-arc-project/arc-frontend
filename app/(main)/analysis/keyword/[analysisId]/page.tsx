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
} from "@/types/analysis";
import { getKeywordResult } from "@/lib/api/analysis-api";
import { formatDateTime } from "@/lib/utils/date-utils";
import { useBasePath } from "@/lib/utils/use-base-path";
import { Badge } from "@/components/ui";

export default function KeywordDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const basePath = useBasePath();
  const [data, setData] = useState<KeywordAnalysisResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getKeywordResult(analysisId)
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
            href={`${basePath}/analysis/keyword`}
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

  const headerTitle = data.keywords.length > 0
    ? `'${data.keywords.join(" · ")}' 키워드 분석`
    : "키워드 분석";

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href={`${basePath}/analysis/keyword`}
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <header className="space-y-2">
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

        <hr className="border-border" />

        <KeywordDefinitionsBlock definitions={data.keywordDefinitions} />

        <SelectionCriteriaBlock criteria={data.selectionCriteria} />

        <CoverageBlock coverage={data.coverage} />

        <MatchedExperiencesBlock groups={data.matchedExperiences} />

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
                  {d.complianceCriteria.map((c, i) => (
                    <li
                      key={i}
                      className="flex gap-2 items-start text-body-sm text-text-secondary"
                    >
                      <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
                      <span className="leading-relaxed">{c}</span>
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
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MatchedExperiencesBlock({ groups }: { groups: KeywordMatchedGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">매칭된 경험</h2>
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.keyword} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="brand">{g.keyword}</Badge>
              <p className="text-caption text-text-tertiary">{g.experiences.length}개 경험</p>
            </div>
            <ul className="space-y-3">
              {g.experiences.map((exp, i) => (
                <ExperienceCard key={`${g.keyword}-${i}`} experience={exp} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExperienceCard({ experience }: { experience: MatchedExperience }) {
  return (
    <li className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-body-sm font-medium text-text-primary">
          {experience.careerTitle || "이력 정보 없음"}
        </h3>
        <p className="text-caption text-text-tertiary">
          {[experience.organization, experience.period].filter(Boolean).join(" · ")}
        </p>
      </div>
      {experience.relevance && (
        <KeyValue label="연관성" value={experience.relevance} />
      )}
      {experience.confidence && (
        <div className="flex items-center gap-2">
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
              <Badge key={i} variant="outline">{c}</Badge>
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
          </header>

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
                      “{q}”
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

function ImprovementGuideBlock({ guide }: { guide: KeywordImprovementGuide }) {
  const empty =
    guide.informationEnhancement.length === 0 &&
    guide.experienceExpansion.length === 0 &&
    guide.keywordSpecificRecommendations.length === 0;
  if (empty) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-title text-text-primary">보완 가이드</h2>

      {guide.informationEnhancement.length > 0 && (
        <BulletGroup label="정보 보강" items={guide.informationEnhancement} />
      )}
      {guide.experienceExpansion.length > 0 && (
        <BulletGroup label="경험 확장" items={guide.experienceExpansion} />
      )}
      {guide.keywordSpecificRecommendations.length > 0 && (
        <div className="space-y-2">
          <p className="text-label text-text-tertiary">키워드별 추천</p>
          <ul className="space-y-2">
            {guide.keywordSpecificRecommendations.map((r, i) => (
              <li
                key={i}
                className="bg-surface border border-border rounded-lg p-3 space-y-1"
              >
                {r.keyword && <Badge variant="brand">{r.keyword}</Badge>}
                <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {r.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BulletGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-label text-text-tertiary">{label}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
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
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-text-tertiary font-medium mb-0.5">{label}</p>
      <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
}
