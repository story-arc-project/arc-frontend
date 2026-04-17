"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  ChevronRight,
  Plus,
  ArrowRight,
  Lightbulb,
  Tags,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useExperiences } from "@/hooks/useExperiences";
import { getAnalysisHomeSummary } from "@/lib/api/analysis-api";
import { toExperienceV2 } from "@/lib/utils/experience-mapper";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2";
import {
  analysisTypeLabel,
  ANALYSIS_DETAIL_PATH,
} from "@/types/analysis";
import type { AnalysisHomeSummary, AnalysisSnapshot } from "@/types/analysis";
import type { Experience } from "@/types/experience";
import type { ExperienceTypeId } from "@/types/archive";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";

// ─── Helpers ────────────────────────────────────────────────

function countThisMonth(experiences: Experience[]): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return experiences.filter((e) => {
    const d = new Date(e.created_at);
    return d.getFullYear() === y && d.getMonth() === m;
  }).length;
}

function calcRecordingPeriod(experiences: Experience[]): string {
  if (experiences.length === 0) return "시작 전";
  let oldest = Infinity;
  for (const e of experiences) {
    const t = new Date(e.created_at).getTime();
    if (isNaN(t)) continue;
    if (t < oldest) oldest = t;
  }
  if (oldest === Infinity) return "시작 전";
  const oldestDate = new Date(oldest);
  const now = new Date();
  const months =
    (now.getFullYear() * 12 + now.getMonth()) -
    (oldestDate.getFullYear() * 12 + oldestDate.getMonth());
  if (months <= 0) return "이번 달";
  return `${months}개월`;
}

function calcTypeDistribution(
  experiences: Experience[],
): { type: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const exp of experiences) {
    map.set(exp.type, (map.get(exp.type) ?? 0) + 1);
  }
  const sorted = [...map.entries()]
    .sort((a, b) => b[1] - a[1]);

  const MAX_VISIBLE = 6;
  if (sorted.length <= MAX_VISIBLE) {
    return sorted.map(([type, count]) => ({
      type,
      label: EXPERIENCE_TYPE_MAP[type as ExperienceTypeId]?.label ?? type,
      count,
    }));
  }

  const visible = sorted.slice(0, MAX_VISIBLE - 1);
  const rest = sorted.slice(MAX_VISIBLE - 1);
  const otherCount = rest.reduce((sum, [, c]) => sum + c, 0);
  return [
    ...visible.map(([type, count]) => ({
      type,
      label: EXPERIENCE_TYPE_MAP[type as ExperienceTypeId]?.label ?? type,
      count,
    })),
    { type: "__system_etc__", label: "기타", count: otherCount },
  ];
}

function todayString(): string {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

// ─── Tab types ──────────────────────────────────────────────

type TabKey = "individual" | "comprehensive" | "keyword";
const TABS: { key: TabKey; label: string }[] = [
  { key: "individual", label: "개별" },
  { key: "comprehensive", label: "종합" },
  { key: "keyword", label: "키워드" },
];


// Tailwind JIT cannot accept dynamic width values, so the distribution bar
// snaps to 12 discrete buckets driven by count/maxTypeCount.
const BAR_WIDTH_CLASSES = [
  "w-0",
  "w-1/12",
  "w-2/12",
  "w-3/12",
  "w-4/12",
  "w-5/12",
  "w-6/12",
  "w-7/12",
  "w-8/12",
  "w-9/12",
  "w-10/12",
  "w-11/12",
  "w-full",
] as const;

function pickBarWidth(count: number, max: number): string {
  if (max <= 0) return BAR_WIDTH_CLASSES[0];
  const bucket = Math.min(
    BAR_WIDTH_CLASSES.length - 1,
    Math.max(0, Math.round((count / max) * 12)),
  );
  return BAR_WIDTH_CLASSES[bucket];
}

// ─── Component ──────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    experiences,
    isLoading: expLoading,
    error: expError,
    refetch: refetchExperiences,
  } = useExperiences();
  const [summary, setSummary] = useState<AnalysisHomeSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState<TabKey>("individual");
  const [mounted, setMounted] = useState(false);

  // One-shot post-hydration flip so date-sensitive nodes render real time
  // only on the client; the SSR output keeps a deterministic placeholder.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    let ignore = false;
    getAnalysisHomeSummary()
      .then((result) => {
        if (!ignore) {
          setSummary(result);
          setSummaryError(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSummary(null);
          setSummaryError(true);
        }
      });
    return () => {
      ignore = true;
    };
  }, [retryKey]);

  const retrySummary = () => {
    setSummaryError(false);
    setRetryKey((k) => k + 1);
  };

  const recentExperiences = useMemo(() => {
    return [...experiences]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
      .map(toExperienceV2);
  }, [experiences]);

  const typeDistribution = useMemo(
    () => calcTypeDistribution(experiences),
    [experiences],
  );

  const maxTypeCount = useMemo(
    () => Math.max(1, ...typeDistribution.map((d) => d.count)),
    [typeDistribution],
  );

  const analysisCompletedLabel = summary
    ? `${summary.stats.analysisCompleted}회`
    : summaryError
      ? "—"
      : "…";

  const statItems = useMemo(() => [
    { label: "총 경험", value: `${experiences.length}개`, icon: FileText, iconColor: "text-brand" },
    {
      label: "이번 달 추가",
      value: mounted ? `${countThisMonth(experiences)}개` : "…",
      icon: TrendingUp,
      iconColor: "text-success",
    },
    {
      label: "기록 기간",
      value: mounted ? calcRecordingPeriod(experiences) : "…",
      icon: Clock,
      iconColor: "text-text-secondary",
    },
    { label: "분석 완료", value: analysisCompletedLabel, icon: CheckCircle, iconColor: "text-brand" },
  ], [experiences, analysisCompletedLabel, mounted]);

  const recentMap: Record<TabKey, AnalysisSnapshot[]> | null = useMemo(
    () =>
      summary
        ? {
            individual: summary.recentIndividual,
            comprehensive: summary.recentComprehensive,
            keyword: summary.recentKeyword,
          }
        : null,
    [summary],
  );

  const userName = user?.profile?.name ?? "사용자";

  // ── Loading skeleton ──
  if (expLoading) {
    return (
      <main className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-6" aria-busy="true">
          <div className="h-8 w-2/5 bg-surface-secondary rounded animate-pulse" />
          <div className="h-5 w-1/4 bg-surface-secondary rounded animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-surface-secondary rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="h-56 bg-surface-secondary rounded-xl animate-pulse" />
            <div className="h-56 bg-surface-secondary rounded-xl animate-pulse" />
          </div>
          {/* Reserve space for Recent Analysis to avoid layout shift after expLoading resolves */}
          <div className="h-6 w-1/5 bg-surface-secondary rounded animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Experience fetch error ──
  if (expError) {
    return (
      <main className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <div
            role="alert"
            aria-live="polite"
            className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center text-center"
          >
            <p className="text-body text-text-secondary mb-3">
              경험 데이터를 불러오지 못했어요.
            </p>
            <button
              type="button"
              onClick={() => {
                void refetchExperiences();
              }}
              className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div>
          <p className="text-body-sm text-text-tertiary mb-1">
            {mounted ? todayString() : "\u00A0"}
          </p>
          <h1 className="text-heading-2 text-text-primary">
            안녕하세요, {userName} 님
          </h1>
          {experiences.length > 0 ? (
            <p className="text-body text-text-secondary mt-1">
              총 {experiences.length}개의 경험이 기록되어 있어요.
            </p>
          ) : (
            <p className="text-body text-text-secondary mt-1">
              첫 경험을 기록하고 나만의 커리어 내러티브를 시작해보세요.
            </p>
          )}
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statItems.map(({ label, value, icon: Icon, iconColor }) => {
            return (
              <div
                key={label}
                className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3"
              >
                <div className={`p-2 rounded-md bg-surface-secondary ${iconColor}`}>
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-heading-3 text-text-primary leading-none">
                    {value}
                  </p>
                  <p className="text-caption text-text-tertiary mt-1">
                    {label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Type Distribution + Recent Experiences ── */}
        {experiences.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Type distribution */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-title text-text-primary mb-4">경험 유형 분포</h2>
              <div className="space-y-3">
                {typeDistribution.map(({ type, label, count }) => (
                  <div key={type}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-body-sm text-text-secondary">{label}</span>
                      <span className="text-label text-text-tertiary">{count}개</span>
                    </div>
                    <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-brand transition-all ${pickBarWidth(count, maxTypeCount)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/archive"
                className="mt-4 flex items-center gap-1 text-label text-brand hover:text-brand-dark transition-colors"
              >
                전체 아카이브 <ChevronRight size={14} />
              </Link>
            </div>

            {/* Recent experiences */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-title text-text-primary mb-4">최근 경험</h2>
              <div className="space-y-3">
                {recentExperiences.map((exp) => {
                  const typeInfo = EXPERIENCE_TYPE_MAP[exp.typeId];
                  return (
                    <div
                      key={exp.id}
                      className="flex flex-col gap-1 py-2 border-b border-border last:border-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-body-sm text-text-primary font-medium truncate">
                          {exp.title || "제목 없음"}
                        </span>
                        <Badge variant="default">
                          {typeInfo?.label ?? exp.typeId}
                        </Badge>
                      </div>
                      <p className="text-caption text-text-tertiary">
                        {mounted ? formatRelativeTime(exp.updatedAt) : "\u00A0"}
                      </p>
                      {exp.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {exp.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-caption text-text-secondary bg-surface-secondary px-1.5 py-0.5 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Link
                href="/archive"
                className="mt-4 flex items-center gap-1 text-label text-brand hover:text-brand-dark transition-colors"
              >
                전체 아카이브 <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* ── Empty state for zero experiences ── */}
        {experiences.length === 0 && (
          <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center text-center">
            <div className="p-3 rounded-full bg-surface-brand mb-4">
              <Plus size={24} className="text-brand" />
            </div>
            <h2 className="text-title text-text-primary mb-1">
              아직 기록된 경험이 없어요
            </h2>
            <p className="text-body-sm text-text-secondary mb-4">
              경험을 기록하면 유형 분포와 최근 활동을 한눈에 볼 수 있어요.
            </p>
            <Link
              href="/archive"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors"
            >
              <Plus size={14} />
              첫 경험 기록하기
            </Link>
          </div>
        )}

        {/* ── Recent Analysis ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title text-text-primary">최근 분석</h2>
            <div
              className="flex border border-border rounded-md overflow-hidden"
              role="tablist"
              aria-label="분석 유형"
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  id={`dash-tab-${t.key}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  aria-controls={`dash-panel-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className={[
                    "px-3 py-1.5 text-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
                    tab === t.key
                      ? "bg-brand text-white"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {summaryError && (
            <div className="py-8 flex flex-col items-center" role="alert">
              <p className="text-body text-text-secondary mb-3">
                분석 데이터를 불러오지 못했습니다.
              </p>
              <button
                type="button"
                onClick={retrySummary}
                className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}

          {!summaryError && !recentMap && (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 bg-surface-secondary rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {recentMap && (
            <div
              className="space-y-3"
              role="tabpanel"
              id={`dash-panel-${tab}`}
              aria-labelledby={`dash-tab-${tab}`}
            >
              {recentMap[tab].length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-body text-text-tertiary">
                    아직 분석 결과가 없습니다.
                  </p>
                  <p className="text-body-sm text-text-tertiary mt-1">
                    경험을 기록하고 분석을 시작해보세요.
                  </p>
                </div>
              ) : (
                recentMap[tab].map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`${ANALYSIS_DETAIL_PATH[snapshot.type]}/${snapshot.id}`}
                        className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-md"
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline">
                            {analysisTypeLabel[snapshot.type]}
                          </Badge>
                          <span className="text-body-sm text-text-primary font-medium truncate">
                            {snapshot.title}
                          </span>
                        </div>
                        <p className="text-body-sm text-text-secondary line-clamp-1">
                          {snapshot.summaryText}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <ConfidenceBadge confidence={snapshot.overallConfidence} />
                          <span className="text-caption text-text-tertiary">
                            {mounted ? formatRelativeTime(snapshot.createdAt) : "\u00A0"}
                          </span>
                        </div>
                      </Link>
                      <BookmarkToggle
                        analysisId={snapshot.id}
                        isBookmarked={snapshot.isBookmarked}
                        size="sm"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mt-4">
            <Link
              href="/analysis"
              className="text-body-sm text-brand font-medium hover:underline"
            >
              분석 홈으로 &rarr;
            </Link>
          </div>
        </section>

        {/* ── Recommendations ── */}
        {summary ? (
          <RecommendationSection
            summary={summary}
            hasExperiences={experiences.length > 0}
          />
        ) : summaryError ? null : (
          <RecommendationSkeleton />
        )}

        {/* ── CTA Cards ── */}
        {experiences.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href="/archive"
              className="group bg-surface border border-border rounded-xl p-5 hover:border-brand transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Plus size={18} className="text-brand" aria-hidden="true" />
                <h3 className="text-title text-text-primary">새 경험 기록하기</h3>
              </div>
              <p className="text-body-sm text-text-secondary">
                오늘의 경험을 기록하고 커리어 스토리를 쌓아보세요.
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-caption text-brand font-medium group-hover:gap-2 transition-all">
                아카이브로 이동 <ArrowRight size={12} aria-hidden="true" />
              </span>
            </Link>
            <Link
              href="/export"
              className="group bg-surface border border-border rounded-xl p-5 hover:border-brand transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText size={18} className="text-brand" aria-hidden="true" />
                <h3 className="text-title text-text-primary">이력서/자소서 만들기</h3>
              </div>
              <p className="text-body-sm text-text-secondary">
                기록된 경험으로 이력서와 자기소개서를 만들어보세요.
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-caption text-brand font-medium group-hover:gap-2 transition-all">
                익스포트로 이동 <ArrowRight size={12} aria-hidden="true" />
              </span>
            </Link>
          </div>
        )}

      </div>
    </main>
  );
}

// ─── Recommendation Sub-component ───────────────────────────

function RecommendationSection({
  summary,
  hasExperiences,
}: {
  summary: AnalysisHomeSummary;
  hasExperiences: boolean;
}) {
  const hasGroups = summary.recommendations.experienceGroups.length > 0;
  const hasKeywords = summary.recommendations.suggestedKeywords.length > 0;

  if (!hasGroups && !hasKeywords) {
    if (!hasExperiences) return null;
    return (
      <section>
        <h2 className="text-title text-text-primary mb-4">추천</h2>
        <div className="bg-surface-secondary border border-border rounded-xl p-6 text-center">
          <Lightbulb size={24} className="text-text-tertiary mx-auto mb-2" aria-hidden="true" />
          <p className="text-body text-text-secondary">
            경험이 쌓이고 있어요!
          </p>
          <p className="text-body-sm text-text-tertiary mt-1">
            분석을 시작하면 맞춤 추천을 받을 수 있어요.
          </p>
          <Link
            href="/analysis"
            className="inline-flex items-center gap-1 mt-3 text-label text-brand hover:text-brand-dark transition-colors"
          >
            분석 시작하기 <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-title text-text-primary mb-4">추천</h2>
      <div className="space-y-4">
        {hasGroups && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-brand" aria-hidden="true" />
              <h3 className="text-body text-text-primary font-medium">
                이 경험들을 함께 분석해보세요
              </h3>
            </div>
            <div className="space-y-2">
              {summary.recommendations.experienceGroups.slice(0, 3).map((group, i) => (
                <div
                  key={i}
                  className="bg-surface-secondary rounded-lg px-4 py-3"
                >
                  <p className="text-body-sm text-text-secondary">
                    {group.reason}
                  </p>
                </div>
              ))}
            </div>
            <Link
              href="/analysis/comprehensive/new"
              className="inline-flex items-center gap-1 mt-3 text-label text-brand hover:text-brand-dark transition-colors"
            >
              종합 분석 시작 <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {hasKeywords && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Tags size={16} className="text-brand" aria-hidden="true" />
              <h3 className="text-body text-text-primary font-medium">
                추천 키워드
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.recommendations.suggestedKeywords.slice(0, 6).map((kw) => (
                <span
                  key={kw.id}
                  className="inline-flex items-center rounded-full px-3 py-1 bg-surface-brand text-brand text-label"
                >
                  {kw.label}
                </span>
              ))}
            </div>
            <Link
              href="/analysis/keyword/new"
              className="inline-flex items-center gap-1 mt-3 text-label text-brand hover:text-brand-dark transition-colors"
            >
              키워드 분석 시작 <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function RecommendationSkeleton() {
  return (
    <section aria-hidden="true">
      <div className="h-6 w-16 bg-surface-secondary rounded mb-4 animate-pulse" />
      <div className="space-y-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="h-4 w-48 bg-surface-secondary rounded mb-3 animate-pulse" />
          <div className="space-y-2">
            <div className="h-12 bg-surface-secondary rounded-lg animate-pulse" />
            <div className="h-12 bg-surface-secondary rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="h-4 w-32 bg-surface-secondary rounded mb-3 animate-pulse" />
          <div className="flex flex-wrap gap-2">
            <div className="h-7 w-16 bg-surface-secondary rounded-full animate-pulse" />
            <div className="h-7 w-20 bg-surface-secondary rounded-full animate-pulse" />
            <div className="h-7 w-14 bg-surface-secondary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}
