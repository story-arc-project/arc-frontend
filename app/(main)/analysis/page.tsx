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
import type { AnalysisHomeSummary, AnalysisType } from "@/types/analysis";
import { analysisTypeLabel } from "@/types/analysis";
import { getAnalysisHomeSummary } from "@/lib/analysis-api";
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

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function AnalysisHomePage() {
  const [data, setData] = useState<AnalysisHomeSummary | null>(null);
  const [tab, setTab] = useState<TabKey>("individual");

  useEffect(() => {
    getAnalysisHomeSummary().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Skeleton */}
          <div className="h-8 w-48 bg-surface-secondary rounded animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-surface-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statItems = [
    { label: "전체 경험", value: data.stats.totalExperiences },
    { label: "분석 완료", value: data.stats.analysisCompleted },
    { label: "최근 분석", value: formatRelativeTime(data.stats.lastAnalysisAt) },
    { label: "보완 필요", value: data.stats.improvementNeeded },
  ];

  const recentMap: Record<TabKey, typeof data.recentIndividual> = {
    individual: data.recentIndividual,
    comprehensive: data.recentComprehensive,
    keyword: data.recentKeyword,
  };

  const detailPath: Record<AnalysisType, string> = {
    individual: "/analysis/individual",
    comprehensive: "/analysis/comprehensive",
    keyword: "/analysis/keyword",
  };

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-heading-2 text-text-primary">분석 홈</h1>
          <p className="text-body text-text-secondary mt-1">
            기록된 경험에서 패턴과 역량을 발견해요.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statItems.map((item, i) => {
            const Icon = STAT_ICONS[i];
            return (
              <div
                key={item.label}
                className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3"
              >
                <div className={`p-2 rounded-md bg-surface-secondary ${STAT_COLORS[i]}`}>
                  <Icon size={18} />
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

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group bg-surface border border-border rounded-lg p-5 hover:border-brand transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <action.icon
                  size={18}
                  className="text-brand"
                />
                <h3 className="text-title text-text-primary">
                  {action.title}
                </h3>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                {action.desc}
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-caption text-brand font-medium group-hover:gap-2 transition-all">
                시작하기 <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>

        {/* Recent Results */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title text-text-primary">최근 분석 결과</h2>
            <div className="flex border border-border rounded-md overflow-hidden">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={[
                    "px-3 py-1.5 text-label transition-colors",
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

          <div className="space-y-3">
            {recentMap[tab].length === 0 ? (
              <p className="text-body-sm text-text-tertiary py-8 text-center">
                아직 분석 결과가 없습니다.
              </p>
            ) : (
              recentMap[tab].map((snapshot) => (
                <Link
                  key={snapshot.id}
                  href={`${detailPath[snapshot.type]}/${snapshot.id}`}
                  className="block bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
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
                    </div>
                    <BookmarkToggle
                      isBookmarked={snapshot.isBookmarked}
                      onToggle={() => {}}
                      size="sm"
                    />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Placeholders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-secondary border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <BarChart3 size={24} className="text-text-tertiary mb-2" />
            <p className="text-body-sm text-text-tertiary">
              시각화 차트 — 준비 중
            </p>
          </div>
          <div className="bg-surface-secondary border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <Lightbulb size={24} className="text-text-tertiary mb-2" />
            <p className="text-body-sm text-text-tertiary">
              추천 — 준비 중
            </p>
          </div>
        </div>

        {/* Bottom Links */}
        <div className="flex items-center gap-4 pt-2">
          <Link
            href="/analysis/history"
            className="text-body-sm text-brand font-medium hover:underline"
          >
            전체 결과 보기 &rarr;
          </Link>
          <Link
            href="/analysis/bookmarks"
            className="text-body-sm text-brand font-medium hover:underline"
          >
            즐겨찾기 바로가기 &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
