"use client";

import { useState } from "react";
import { Filter, Tag, BarChart2, Clock } from "lucide-react";
import { Badge } from "@/components/ui";

type ViewMode = "keywords" | "timeline";
type FilterType = "전체" | "프로젝트" | "인턴" | "대외활동" | "수상" | "자격증";

const FILTER_TYPES: FilterType[] = ["전체", "프로젝트", "인턴", "대외활동", "수상", "자격증"];

const KEYWORD_DATA = [
  { keyword: "기획", count: 9, category: "역량" },
  { keyword: "협업", count: 8, category: "역량" },
  { keyword: "UX 리서치", count: 6, category: "역량" },
  { keyword: "데이터 분석", count: 5, category: "역량" },
  { keyword: "리더십", count: 5, category: "역량" },
  { keyword: "발표·커뮤니케이션", count: 4, category: "역량" },
  { keyword: "Python", count: 4, category: "기술" },
  { keyword: "Figma", count: 3, category: "기술" },
  { keyword: "사용자 인터뷰", count: 3, category: "방법론" },
  { keyword: "애자일", count: 2, category: "방법론" },
];

const EXPERIENCES = [
  { id: "1", title: "UX 리서치 인턴십", type: "인턴" as FilterType, date: "2024.07", tags: ["UX", "리서치", "협업"], summary: "스타트업에서 앱 사용자 인터뷰 설계 및 분석을 주도했습니다." },
  { id: "2", title: "캡스톤 디자인 프로젝트", type: "프로젝트" as FilterType, date: "2024.03", tags: ["기획", "팀리더", "발표"], summary: "6인 팀 리더로서 서비스 기획부터 프로토타입까지 총괄했습니다." },
  { id: "3", title: "교내 창업 경진대회 금상", type: "수상" as FilterType, date: "2023.11", tags: ["수상", "아이디어"], summary: "사회문제 해결형 비즈니스 모델 기획으로 금상을 수상했습니다." },
  { id: "4", title: "데이터 분석 대외활동", type: "대외활동" as FilterType, date: "2023.09", tags: ["데이터 분석", "Python"], summary: "공공데이터를 활용한 분석 프로젝트를 수행했습니다." },
  { id: "5", title: "SQLD 자격증 취득", type: "자격증" as FilterType, date: "2023.06", tags: ["SQL", "DB"], summary: "데이터베이스 설계 및 쿼리 역량을 검증받았습니다." },
];

const TIMELINE_MONTHS = [
  { month: "2024.07", items: ["UX 리서치 인턴십"] },
  { month: "2024.03", items: ["캡스톤 디자인 프로젝트"] },
  { month: "2023.11", items: ["교내 창업 경진대회 금상"] },
  { month: "2023.09", items: ["데이터 분석 대외활동"] },
  { month: "2023.06", items: ["SQLD 자격증 취득"] },
];

const MAX_KEYWORD_COUNT = Math.max(...KEYWORD_DATA.map((k) => k.count));

export default function AnalysisPage() {
  const [view, setView] = useState<ViewMode>("keywords");
  const [activeFilter, setActiveFilter] = useState<FilterType>("전체");

  const filtered = activeFilter === "전체"
    ? EXPERIENCES
    : EXPERIENCES.filter((e) => e.type === activeFilter);

  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-heading-2 text-text-primary">커리어 분석</h1>
          <p className="text-body text-text-secondary mt-1">기록된 경험에서 패턴과 역량을 발견해요.</p>
        </div>

        {/* View toggle + filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("keywords")}
              className={[
                "flex items-center gap-1.5 px-3 py-2 text-label transition-colors",
                view === "keywords"
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary",
              ].join(" ")}
            >
              <Tag size={14} />
              키워드
            </button>
            <button
              onClick={() => setView("timeline")}
              className={[
                "flex items-center gap-1.5 px-3 py-2 text-label transition-colors border-l border-border",
                view === "timeline"
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary",
              ].join(" ")}
            >
              <Clock size={14} />
              타임라인
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={13} className="text-text-tertiary" />
            {FILTER_TYPES.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={[
                  "text-label px-2.5 py-1 rounded-md border transition-colors",
                  activeFilter === f
                    ? "border-brand bg-surface-brand text-brand"
                    : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* View: Keywords */}
        {view === "keywords" && (
          <div className="space-y-6">
            {/* Keyword frequency chart */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 size={15} className="text-text-secondary" />
                <h2 className="text-title text-text-primary">역량 키워드 빈도</h2>
              </div>
              <div className="space-y-2.5">
                {KEYWORD_DATA.map(({ keyword, count, category }) => (
                  <div key={keyword} className="flex items-center gap-3">
                    <span className="text-body-sm text-text-secondary w-36 shrink-0 truncate">{keyword}</span>
                    <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full"
                        style={{ width: `${(count / MAX_KEYWORD_COUNT) * 100}%` }}
                      />
                    </div>
                    <span className="text-label text-text-tertiary w-8 text-right shrink-0">{count}</span>
                    <Badge variant="default">{category}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Experience list */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-title text-text-primary mb-4">
                경험 목록
                <span className="text-body-sm text-text-tertiary font-normal ml-2">{filtered.length}개</span>
              </h2>
              <div className="divide-y divide-border">
                {filtered.map((exp) => (
                  <div key={exp.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <Badge variant="default" className="mt-0.5 shrink-0">{exp.type}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-body-sm text-text-primary font-medium">{exp.title}</span>
                          <span className="text-caption text-text-tertiary">{exp.date}</span>
                        </div>
                        <p className="text-body-sm text-text-secondary mt-1 leading-relaxed">{exp.summary}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {exp.tags.map((tag) => (
                            <span key={tag} className="text-caption text-text-secondary bg-surface-secondary px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* View: Timeline */}
        {view === "timeline" && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-title text-text-primary mb-6">경험 타임라인</h2>
            <div className="relative pl-4">
              {/* vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-6">
                {TIMELINE_MONTHS.map(({ month, items }) => (
                  <div key={month} className="relative flex gap-4 items-start">
                    <div className="w-3 h-3 rounded-full bg-brand border-2 border-surface shrink-0 mt-0.5 z-10" />
                    <div className="flex-1 min-w-0">
                      <p className="text-label text-text-tertiary mb-1.5">{month}</p>
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <div key={item} className="bg-surface-secondary border border-border rounded-lg px-3 py-2">
                            <span className="text-body-sm text-text-primary">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
