import type { AnalysisHomeSummary } from "@/types/analysis";

export const demoAnalysisHome: AnalysisHomeSummary = {
  stats: {
    totalExperiences: 9,
    analysisCompleted: 3,
    lastAnalysisAt: "2026-04-17T15:22:00Z",
    improvementNeeded: 1,
  },
  recentIndividual: [
    {
      id: "ind-1",
      type: "individual",
      title: "오늘의 집 마케팅 인턴 분석",
      status: "completed",
      createdAt: "2026-04-17T15:22:00Z",
      experienceCount: 1,
      summaryText: "GA4 기반 퍼포먼스 마케팅 실전 감각과 숫자 커뮤니케이션이 잘 드러나는 경험입니다.",
      overallConfidence: "sufficient",
      isBookmarked: true,
      selectedExperienceIds: ["exp-1"],
    },
  ],
  recentComprehensive: [
    {
      id: "comp-1",
      type: "comprehensive",
      title: "디지털 마케팅 커리어 종합 분석",
      status: "completed",
      createdAt: "2026-04-16T09:40:00Z",
      experienceCount: 4,
      summaryText: "데이터·브랜드·실전이 3개 경험에서 일관되게 연결됩니다. 정규직 전환 경험 부재가 약점.",
      overallConfidence: "sufficient",
      isBookmarked: true,
      selectedExperienceIds: ["exp-1", "exp-2", "exp-3", "exp-4"],
    },
  ],
  recentKeyword: [
    {
      id: "kw-1",
      type: "keyword",
      title: "'데이터 분석 · 브랜드 기획' 키워드 분석",
      status: "completed",
      createdAt: "2026-04-14T14:00:00Z",
      experienceCount: 6,
      summaryText: "데이터 분석 부합도는 충분, 브랜드 기획은 부분. 브랜드 실전 증거 보강이 필요합니다.",
      overallConfidence: "partial",
      isBookmarked: false,
      selectedKeywords: ["데이터 분석", "브랜드 기획"],
    },
  ],
  recommendations: {
    experienceGroups: [
      {
        experienceIds: ["exp-1", "exp-4", "exp-6"],
        reason: "퍼포먼스 마케팅 인턴 · 부스트캠프 · GAIQ를 묶으면 '데이터 기반 마케터' 스토리가 완성돼요.",
      },
      {
        experienceIds: ["exp-2", "exp-9", "exp-7"],
        reason: "동아리 운영 · 학생회 · 봉사를 연결하면 '구조를 만드는 리더' 내러티브가 보여요.",
      },
    ],
    suggestedKeywords: [
      {
        id: "sk-1",
        label: "퍼포먼스 마케팅",
        category: "skill",
        reason: "4개 경험에서 캠페인/측정/최적화 신호가 발견됐어요.",
        relatedExperienceCount: 4,
      },
      {
        id: "sk-2",
        label: "구조 설계 리더십",
        category: "work_style",
        reason: "동아리·학생회·봉사 운영에서 리듬 설계형 행동이 반복돼요.",
        relatedExperienceCount: 3,
      },
      {
        id: "sk-3",
        label: "브랜드 전략",
        category: "job_domain",
        reason: "공모전과 블로그에서 브랜드 기획 근거가 있어요.",
        relatedExperienceCount: 2,
      },
    ],
  },
};
