"use client";

import { useState } from "react";
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
import { analysisTypeLabel } from "@/types/analysis";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import { Badge } from "@/components/ui";
import ConfidenceBadge from "@/components/features/analysis/common/ConfidenceBadge";
import BookmarkToggle from "@/components/features/analysis/common/BookmarkToggle";
import { demoAnalysisHome } from "../_data/analysis-home";

const STAT_ICONS = [FileText, CheckCircle, Clock, AlertTriangle] as const;
const STAT_COLORS = [
  "text-brand",
  "text-success",
  "text-text-secondary",
  "text-warning",
];

const QUICK_ACTIONS = [
  {
    href: "/demo/analysis/individual/ind-1",
    icon: FileSearch,
    title: "개별 분석 보기",
    desc: "경험 하나하나의 역량과 강점을 분석합니다.",
  },
  {
    href: "/demo/analysis/comprehensive/comp-1",
    icon: Layers,
    title: "종합 분석 보기",
    desc: "여러 경험을 묶어 일관된 스토리라인을 만듭니다.",
  },
  {
    href: "/demo/analysis/keyword/kw-1",
    icon: Tags,
    title: "키워드 분석 보기",
    desc: "특정 키워드에 부합하는 경험을 찾아 분석합니다.",
  },
];

const DEMO_DETAIL_PATH: Record<string, string> = {
  individual: "/demo/analysis/individual",
  comprehensive: "/demo/analysis/comprehensive",
  keyword: "/demo/analysis/keyword",
};

type TabKey = "individual" | "comprehensive" | "keyword";
const TABS: { key: TabKey; label: string }[] = [
  { key: "individual", label: "개별" },
  { key: "comprehensive", label: "종합" },
  { key: "keyword", label: "키워드" },
];

export default function DemoAnalysisHomePage() {
  const [tab, setTab] = useState<TabKey>("individual");
  const data = demoAnalysisHome;

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
        <div>
          <h1 className="text-heading-2 text-text-primary">분석 홈</h1>
          <p className="text-body text-text-secondary mt-1">
            기록된 경험에서 패턴과 역량을 발견해요.
          </p>
        </div>

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
                  <p className="text-heading-3 text-text-primary leading-none">{item.value}</p>
                  <p className="text-caption text-text-tertiary mt-1">{item.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group bg-surface border border-border rounded-lg p-5 hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex items-center gap-2 mb-2">
                <action.icon size={18} className="text-brand" aria-hidden="true" />
                <h3 className="text-title text-text-primary">{action.title}</h3>
              </div>
              <p className="text-body-sm text-text-secondary leading-relaxed">{action.desc}</p>
              <span className="inline-flex items-center gap-1 mt-3 text-caption text-brand font-medium group-hover:gap-2 transition-all">
                바로 보기 <ArrowRight size={12} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-title text-text-primary">최근 분석 결과</h2>
            <div className="flex border border-border rounded-md overflow-hidden" role="tablist" aria-label="분석 유형">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={[
                    "px-3 py-1.5 text-label transition-colors",
                    tab === t.key
                      ? "bg-brand text-text-on-brand"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3" role="tabpanel">
            {recentMap[tab].length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-body text-text-tertiary">아직 분석 결과가 없습니다.</p>
              </div>
            ) : (
              recentMap[tab].map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`${DEMO_DETAIL_PATH[snapshot.type]}/${snapshot.id}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline">{analysisTypeLabel[snapshot.type]}</Badge>
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
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-secondary border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <BarChart3 size={24} className="text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-body-sm text-text-tertiary">시각화 차트 — 준비 중</p>
          </div>
          <div className="bg-surface-secondary border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <Lightbulb size={24} className="text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-body-sm text-text-tertiary">추천 — 준비 중</p>
          </div>
        </div>
      </div>
    </main>
  );
}
