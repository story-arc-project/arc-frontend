"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileSearch,
  Layers,
  Tags,
  ArrowRight,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import type { AnalysisHomeSummary } from "@/types/analysis";
import { analysisTypeLabel, ANALYSIS_DETAIL_PATH } from "@/types/analysis";
import { getAnalysisHomeSummary } from "@/lib/api/analysis-api";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import { useBasePath } from "@/lib/utils/use-base-path";
import { Badge } from "@/components/ui";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";

const STAT_ICONS = [FileText, CheckCircle, Clock, AlertTriangle] as const;
const STAT_COLORS = [
  "text-brand",
  "text-success",
  "text-text-secondary",
  "text-warning",
];

const QUICK_ACTIONS = [
  {
    href: "/analysis/individual",
    icon: FileSearch,
    title: "개별 분석 보기",
    desc: "경험 하나하나의 역량과 강점을 분석합니다.",
  },
  {
    href: "/analysis/comprehensive/new",
    icon: Layers,
    title: "종합 분석 시작",
    desc: "여러 경험을 묶어 일관된 스토리라인을 만듭니다.",
  },
  {
    href: "/analysis/keyword/new",
    icon: Tags,
    title: "키워드 분석 시작",
    desc: "특정 키워드에 부합하는 경험을 찾아 분석합니다.",
  },
];

type TabKey = "individual" | "comprehensive" | "keyword";
const TABS: { key: TabKey; label: string }[] = [
  { key: "individual", label: "개별" },
  { key: "comprehensive", label: "종합" },
  { key: "keyword", label: "키워드" },
];

export default function AnalysisHomePage() {
  const basePath = useBasePath();
  const [data, setData] = useState<AnalysisHomeSummary | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TabKey>("individual");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    getAnalysisHomeSummary()
      .then((result) => { if (!ignore) { setData(result); setError(false); } })
      .catch(() => { if (!ignore) setError(true); });
    return () => { ignore = true; };
  }, [retryKey]);

  if (error) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-16" role="alert">
          <p className="text-body text-text-secondary mb-3">
            데이터를 불러오지 못했습니다.
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 rounded-md bg-brand text-white text-label hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="px-4 py-8 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-6" aria-busy="true">
          <div className="h-8 w-2/5 bg-surface-secondary rounded animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-surface-secondary rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-surface-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  const statItems = [
    { label: "전체 경험", value: data.stats.totalExperiences },
    { label: "분석 완료", value: data.stats.analysisCompleted },
    { label: "최근 분석", value: data.stats.lastAnalysisAt ? formatRelativeTime(data.stats.lastAnalysisAt) : "-" },
    { label: "보완 필요", value: data.stats.improvementNeeded },
  ];

  const recentMap: Record<TabKey, typeof data.recentIndividual> = {
    individual: data.recentIndividual,
    comprehensive: data.recentComprehensive,
    keyword: data.recentKeyword,
  };

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-heading-2 text-text-primary">분석 홈</h1>
          <p className="text-body text-text-secondary mt-1">
            기록된 경험에서 패턴과 역량을 발견해요.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {statItems.map((item, i) => {
            const Icon = STAT_ICONS[i];
            return (
              <div
                key={item.label}
                className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3"
              >
                <div className={`p-2 rounded-md bg-surface-secondary ${STAT_COLORS[i]}`}>
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-heading-3 text-text-primary leading-none">
                    {item.value}
                  </p>
                  <p className="text-caption text-text-tertiary mt-1">
                    {item.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions — 데모에서는 list/new 페이지를 미러링하지 않으므로 숨긴다 */}
        {basePath === "" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={`${basePath}${action.href}`}
              className="group bg-surface border border-border rounded-lg p-5 hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex items-center gap-2 mb-2">
                <action.icon size={18} className="text-brand" aria-hidden="true" />
                <h3 className="text-title text-text-primary">
                  {action.title}
                </h3>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                {action.desc}
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-caption text-brand font-medium group-hover:gap-2 transition-all">
                시작하기 <ArrowRight size={12} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
        )}

        {/* Recent Results */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title text-text-primary">최근 분석 결과</h2>
            <div className="flex border border-border rounded-md overflow-hidden" role="tablist" aria-label="분석 유형">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  id={`recent-tab-${t.key}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  aria-controls={`recent-panel-${t.key}`}
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

          <div className="space-y-3" role="tabpanel" id={`recent-panel-${tab}`} aria-labelledby={`recent-tab-${tab}`}>
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
              recentMap[tab].map((snapshot) => {
                const isNavigable = snapshot.status === "completed";
                return (
                  <div
                    key={snapshot.id}
                    className={[
                      "bg-surface border border-border rounded-lg p-4",
                      !isNavigable ? "opacity-60 cursor-not-allowed" : "hover:border-brand transition-colors",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {isNavigable ? (
                        <Link
                          href={`${basePath}${ANALYSIS_DETAIL_PATH[snapshot.type]}/${snapshot.id}`}
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
                              {formatRelativeTime(snapshot.createdAt)}
                            </span>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline">
                              {analysisTypeLabel[snapshot.type]}
                            </Badge>
                            <span className="text-body-sm text-text-primary font-medium truncate">
                              {snapshot.title}
                            </span>
                          </div>
                          <p className="text-body-sm text-text-tertiary line-clamp-1">
                            {snapshot.status === "failed" ? "분석에 실패했습니다" : "분석 진행 중..."}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-caption text-text-tertiary">
                              {formatRelativeTime(snapshot.createdAt)}
                            </span>
                          </div>
                        </div>
                      )}
                      <BookmarkToggle
                        analysisId={snapshot.id}
                        isBookmarked={snapshot.isBookmarked}
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Placeholders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-secondary border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <BarChart3 size={24} className="text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-body-sm text-text-tertiary">
              시각화 차트 — 준비 중
            </p>
          </div>
          <div className="bg-surface-secondary border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <Lightbulb size={24} className="text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-body-sm text-text-tertiary">
              추천 — 준비 중
            </p>
          </div>
        </div>

        {/* Bottom Links — 데모에서는 history/bookmarks 페이지를 미러링하지 않으므로 숨긴다 */}
        {basePath === "" && (
        <div className="flex items-center gap-4 pt-2">
          <Link
            href={`${basePath}/analysis/history`}
            className="text-body-sm text-brand font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
          >
            전체 결과 보기 &rarr;
          </Link>
          <Link
            href={`${basePath}/analysis/bookmarks`}
            className="text-body-sm text-brand font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
          >
            즐겨찾기 바로가기 &rarr;
          </Link>
        </div>
        )}
      </div>
    </main>
  );
}
