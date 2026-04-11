import type {
  AnalysisHomeSummary,
  AnalysisSnapshot,
  IndividualAnalysisResult,
  ComprehensiveAnalysisResult,
  KeywordAnalysisResult,
  KeywordSuggestion,
  BookmarkedSnapshot,
} from "@/types/analysis";

// ─── Analysis Home ──────────────────────────────────────────

export const mockAnalysisHomeSummary: AnalysisHomeSummary = {
  stats: {
    totalExperiences: 12,
    analysisCompleted: 8,
    lastAnalysisAt: "2026-04-09T14:30:00Z",
    improvementNeeded: 3,
  },
  recentIndividual: [
    {
      id: "ind-1",
      type: "individual",
      title: "카카오 프론트엔드 인턴십 분석",
      status: "completed",
      createdAt: "2026-04-09T14:30:00Z",
      experienceCount: 1,
      summaryText: "프론트엔드 개발 역량과 협업 능력이 잘 드러나는 경험입니다.",
      overallConfidence: "sufficient",
      isBookmarked: true,
    },
    {
      id: "ind-2",
      type: "individual",
      title: "캡스톤 디자인 프로젝트 분석",
      status: "completed",
      createdAt: "2026-04-07T10:00:00Z",
      experienceCount: 1,
      summaryText: "리더십과 기획력이 돋보이지만, 성과 지표 보완이 필요합니다.",
      overallConfidence: "partial",
      isBookmarked: false,
    },
    {
      id: "ind-3",
      type: "individual",
      title: "데이터 분석 대외활동 분석",
      status: "completed",
      createdAt: "2026-04-05T16:00:00Z",
      experienceCount: 1,
      summaryText: "분석 역량의 근거가 부족합니다. 구체적 성과를 추가해보세요.",
      overallConfidence: "insufficient",
      isBookmarked: false,
    },
  ],
  recentComprehensive: [
    {
      id: "comp-1",
      type: "comprehensive",
      title: "개발 직무 종합 분석",
      status: "completed",
      createdAt: "2026-04-08T12:00:00Z",
      experienceCount: 4,
      summaryText: "개발 직무에 대한 일관된 역량 흐름이 확인됩니다.",
      overallConfidence: "sufficient",
      isBookmarked: true,
    },
    {
      id: "comp-2",
      type: "comprehensive",
      title: "기획 직무 종합 분석",
      status: "completed",
      createdAt: "2026-04-06T09:00:00Z",
      experienceCount: 3,
      summaryText: "기획 경험 간 연결이 약합니다. 보완 활동을 추천합니다.",
      overallConfidence: "partial",
      isBookmarked: false,
    },
  ],
  recentKeyword: [
    {
      id: "kw-1",
      type: "keyword",
      title: "'리더십 · 협업' 키워드 분석",
      status: "completed",
      createdAt: "2026-04-04T11:00:00Z",
      experienceCount: 5,
      summaryText: "리더십 키워드 부합도가 높으며, 협업은 보완이 필요합니다.",
      overallConfidence: "partial",
      isBookmarked: false,
      selectedKeywords: ["리더십", "협업"],
    },
  ],
  recommendations: {
    experienceGroups: [
      {
        experienceIds: ["exp-v2-1", "exp-v2-3"],
        reason: "개발 인턴 + 프로젝트 경험을 묶으면 기술 성장 스토리를 만들 수 있어요.",
      },
      {
        experienceIds: ["exp-v2-2", "exp-v2-4"],
        reason: "대외활동과 수상 경험을 연결하면 주도성을 증명할 수 있어요.",
      },
    ],
    suggestedKeywords: [
      { id: "sk-1", label: "문제 해결", category: "skill", reason: "3개 경험에서 문제 해결 패턴이 발견됨", relatedExperienceCount: 3 },
      { id: "sk-2", label: "자기주도성", category: "work_style", reason: "인턴과 프로젝트에서 주도적 행동 근거가 있음", relatedExperienceCount: 2 },
      { id: "sk-3", label: "성장 지향", category: "value", reason: "시간순 역량 성장이 확인됨", relatedExperienceCount: 4 },
    ],
  },
};

// ─── Individual Analysis ────────────────────────────────────

export const mockIndividualAnalysisList: AnalysisSnapshot[] = [
  {
    id: "ind-1",
    type: "individual",
    title: "카카오 프론트엔드 인턴십",
    status: "completed",
    createdAt: "2026-04-09T14:30:00Z",
    experienceCount: 1,
    summaryText: "프론트엔드 개발 역량과 협업 능력이 잘 드러나는 경험입니다.",
    overallConfidence: "sufficient",
    isBookmarked: true,
  },
  {
    id: "ind-2",
    type: "individual",
    title: "캡스톤 디자인 프로젝트",
    status: "completed",
    createdAt: "2026-04-07T10:00:00Z",
    experienceCount: 1,
    summaryText: "리더십과 기획력이 돋보이지만, 성과 지표 보완이 필요합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
  },
  {
    id: "ind-3",
    type: "individual",
    title: "데이터 분석 대외활동",
    status: "completed",
    createdAt: "2026-04-05T16:00:00Z",
    experienceCount: 1,
    summaryText: "분석 역량의 근거가 부족합니다.",
    overallConfidence: "insufficient",
    isBookmarked: false,
  },
  {
    id: "ind-4",
    type: "individual",
    title: "교내 창업 경진대회 금상",
    status: "completed",
    createdAt: "2026-04-03T08:00:00Z",
    experienceCount: 1,
    summaryText: "비즈니스 모델 기획과 발표 역량이 확인됩니다.",
    overallConfidence: "sufficient",
    isBookmarked: false,
  },
  {
    id: "ind-5",
    type: "individual",
    title: "UX 리서치 프로젝트",
    status: "completed",
    createdAt: "2026-04-01T12:00:00Z",
    experienceCount: 1,
    summaryText: "사용자 중심 사고와 리서치 역량이 잘 드러납니다.",
    overallConfidence: "sufficient",
    isBookmarked: true,
  },
  {
    id: "ind-6",
    type: "individual",
    title: "동아리 운영 경험",
    status: "pending",
    createdAt: "2026-03-28T09:00:00Z",
    experienceCount: 1,
    summaryText: "",
    overallConfidence: "insufficient",
    isBookmarked: false,
  },
  {
    id: "ind-7",
    type: "individual",
    title: "해외 봉사활동",
    status: "pending",
    createdAt: "2026-03-25T15:00:00Z",
    experienceCount: 1,
    summaryText: "",
    overallConfidence: "insufficient",
    isBookmarked: false,
  },
  {
    id: "ind-8",
    type: "individual",
    title: "오픈소스 컨트리뷰션",
    status: "completed",
    createdAt: "2026-04-02T18:00:00Z",
    experienceCount: 1,
    summaryText: "기술적 깊이는 좋지만, 협업 맥락 보완이 필요합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
  },
];

export const mockIndividualAnalysisResult: IndividualAnalysisResult = {
  id: "ind-1",
  experienceId: "exp-v2-1",
  experienceTitle: "카카오 프론트엔드 인턴십",
  experienceType: "career",
  analyzedAt: "2026-04-09T14:30:00Z",
  isBookmarked: true,
  overallConfidence: "sufficient",
  summary:
    "6개월간 카카오에서 프론트엔드 인턴으로 근무하며, 신규 기능 개발과 성능 최적화를 주도한 경험입니다. 실무 환경에서의 협업 역량과 기술 성장이 잘 드러납니다.",
  incidents: [
    {
      id: "inc-1",
      situation: "주요 페이지 렌더링 속도가 3초 이상으로 사용자 이탈률이 증가하는 상황",
      action: "React 프로파일러로 병목 지점을 분석하고, 코드 스플리팅과 메모이제이션을 적용",
      result: "렌더링 속도 40% 개선, 이탈률 15% 감소",
      evidence: {
        quote: "주요 페이지 성능 40% 개선이라는 구체적 성과를 달성했습니다.",
        sourceField: "핵심 성과",
        experienceTitle: "카카오 프론트엔드 인턴십",
      },
    },
    {
      id: "inc-2",
      situation: "신규 대시보드 기능 개발 요청이 들어왔으나, 기존 컴포넌트 구조로는 확장이 어려운 상황",
      action: "컴포넌트 아키텍처를 재설계하고, 재사용 가능한 공통 컴포넌트 라이브러리를 구축",
      result: "이후 기능 개발 시간 30% 단축, 코드 리뷰에서 긍정적 피드백",
      evidence: {
        quote: "프론트엔드 개발자로서 신규 기능 개발과 코드 리뷰 참여",
        sourceField: "내 역할/기여도",
        experienceTitle: "카카오 프론트엔드 인턴십",
      },
    },
  ],
  roleInterpretations: [
    {
      incidentId: "inc-1",
      role: {
        responsibility: "페이지 성능 최적화 전담",
        scope: "프론트엔드 팀 내 성능 개선 태스크",
        decisionAuthority: "최적화 방법론 선택 및 적용 범위 결정",
      },
      action: { type: "문제 해결", description: "프로파일링 기반 체계적 성능 분석 후 최적화 적용" },
      performance: {
        metric: "렌더링 속도 40% 개선",
        output: "최적화된 코드베이스",
        change: "사용자 이탈률 15% 감소",
      },
    },
    {
      incidentId: "inc-2",
      role: {
        responsibility: "공통 컴포넌트 라이브러리 설계",
        scope: "팀 전체 프론트엔드 아키텍처",
        decisionAuthority: "컴포넌트 구조 및 API 설계",
      },
      action: { type: "설계/구축", description: "재사용 가능한 컴포넌트 아키텍처 설계 및 구현" },
      performance: {
        metric: "기능 개발 시간 30% 단축",
        output: "공통 컴포넌트 라이브러리",
        change: "팀 생산성 향상",
      },
    },
  ],
  keywords: [
    {
      id: "k-1",
      label: "프론트엔드 개발",
      category: "skill",
      confidence: "sufficient",
      evidences: [
        { quote: "React 프로파일러로 병목 지점을 분석하고, 코드 스플리팅과 메모이제이션을 적용", experienceTitle: "카카오 프론트엔드 인턴십" },
      ],
    },
    {
      id: "k-2",
      label: "문제 해결",
      category: "skill",
      confidence: "sufficient",
      evidences: [
        { quote: "렌더링 속도가 3초 이상이라는 문제를 체계적으로 분석하여 해결", experienceTitle: "카카오 프론트엔드 인턴십" },
      ],
    },
    {
      id: "k-3",
      label: "자기주도성",
      category: "work_style",
      confidence: "partial",
      evidences: [
        { quote: "컴포넌트 아키텍처를 재설계하고, 재사용 가능한 공통 컴포넌트 라이브러리를 구축", experienceTitle: "카카오 프론트엔드 인턴십" },
      ],
    },
    {
      id: "k-4",
      label: "성장 지향",
      category: "value",
      confidence: "partial",
      evidences: [
        { quote: "인턴 기간 동안 성능 최적화와 아키텍처 설계까지 역할을 확장", experienceTitle: "카카오 프론트엔드 인턴십" },
      ],
    },
  ],
  starSummaries: [
    {
      incidentId: "inc-1",
      situation: "주요 페이지 렌더링 속도가 3초 이상으로 사용자 이탈률 증가",
      task: "페이지 성능 최적화를 통해 이탈률 감소",
      action: "React 프로파일러 분석 → 코드 스플리팅 + 메모이제이션 적용",
      result: "렌더링 속도 40% 개선, 이탈률 15% 감소",
      missingFields: [],
    },
    {
      incidentId: "inc-2",
      situation: "기존 컴포넌트 구조로는 신규 기능 확장이 어려운 상황",
      task: "확장 가능한 컴포넌트 아키텍처 구축",
      action: "컴포넌트 라이브러리 재설계 및 구현",
      result: "기능 개발 시간 30% 단축",
      missingFields: [],
    },
  ],
  recommendations: [
    {
      id: "rec-1",
      activity: "성능 최적화 사례를 기술 블로그로 정리",
      reason: "구체적 수치와 방법론이 있어 설득력 있는 콘텐츠가 될 수 있습니다.",
      evidence: { quote: "렌더링 속도 40% 개선", experienceTitle: "카카오 프론트엔드 인턴십" },
      expectedEffect: "기술 커뮤니케이션 역량 증명 + 포트폴리오 강화",
      type: "expand",
    },
    {
      id: "rec-2",
      activity: "오픈소스 프로젝트에 성능 관련 PR 기여",
      reason: "실무 성능 최적화 경험을 오픈소스 기여로 확장하면 역량의 깊이를 증명할 수 있습니다.",
      evidence: { quote: "코드 스플리팅과 메모이제이션을 적용", experienceTitle: "카카오 프론트엔드 인턴십" },
      expectedEffect: "기술 역량의 외부 검증 + 커뮤니티 참여 이력",
      type: "expand",
    },
    {
      id: "rec-3",
      activity: "협업 과정에서의 갈등 해결 사례 보완",
      reason: "기술적 성과는 충분하지만, 협업 맥락에서의 소통 사례가 부족합니다.",
      evidence: { quote: "코드 리뷰에서 긍정적 피드백", experienceTitle: "카카오 프론트엔드 인턴십" },
      expectedEffect: "협업 역량 근거 강화",
      type: "supplement",
    },
  ],
  improvementGuides: [
    {
      reason: "협업 과정에서의 구체적인 소통 사례가 부족합니다.",
      suggestion: "코드 리뷰나 팀 미팅에서 의견 조율한 사례를 추가해보세요.",
      targetField: "내 역할/기여도",
    },
    {
      reason: "인턴 기간 동안의 학습 과정이 명시되어 있지 않습니다.",
      suggestion: "새로운 기술을 습득한 과정이나 멘토링 경험을 기록해보세요.",
    },
  ],
  reusableExpressions: [
    { type: "30s_summary", label: "30초 요약", text: "카카오에서 6개월간 프론트엔드 인턴으로 근무하며, 주요 페이지 성능을 40% 개선하고 공통 컴포넌트 라이브러리를 구축하여 팀 생산성을 30% 향상시켰습니다." },
    { type: "performance", label: "성과 중심", text: "React 프로파일러 기반 체계적 분석으로 렌더링 속도 40%를 개선했고, 재사용 가능한 컴포넌트 아키텍처를 설계하여 이후 기능 개발 시간을 30% 단축했습니다." },
    { type: "problem_solving", label: "문제 해결", text: "페이지 렌더링 3초 초과 문제를 프로파일링으로 진단하고, 코드 스플리팅과 메모이제이션을 적용해 속도 40% 개선과 이탈률 15% 감소를 이끌어냈습니다." },
    { type: "collaboration", label: "협업", text: "프론트엔드 팀의 코드 리뷰 문화에 적극 참여하며, 공통 컴포넌트 라이브러리를 제안·구축하여 팀 전체의 개발 효율성을 높였습니다." },
    { type: "learning", label: "학습/성장", text: "인턴 기간 동안 성능 최적화와 컴포넌트 아키텍처 설계까지 역할을 확장하며, 실무 프론트엔드 개발의 전반적인 역량을 성장시켰습니다." },
  ],
  relatedExperiences: [
    {
      experienceId: "exp-v2-3",
      title: "캡스톤 디자인 프로젝트",
      reason: "같은 프론트엔드 기술 스택을 활용한 프로젝트로, 기술 성장 스토리를 연결할 수 있습니다.",
      connectionType: "temporal_growth",
    },
    {
      experienceId: "exp-v2-4",
      title: "오픈소스 컨트리뷰션",
      reason: "개인 프로젝트에서 실무로 확장된 역할 변화를 보여줄 수 있습니다.",
      connectionType: "role_expansion",
    },
  ],
};

// ─── Comprehensive Analysis ─────────────────────────────────

export const mockComprehensiveList: AnalysisSnapshot[] = [
  {
    id: "comp-1",
    type: "comprehensive",
    title: "개발 직무 종합 분석",
    status: "completed",
    createdAt: "2026-04-08T12:00:00Z",
    experienceCount: 4,
    summaryText: "개발 직무에 대한 일관된 역량 흐름이 확인됩니다.",
    overallConfidence: "sufficient",
    isBookmarked: true,
    selectedExperienceIds: ["exp-v2-1", "exp-v2-3", "ind-5", "ind-8"],
  },
  {
    id: "comp-2",
    type: "comprehensive",
    title: "기획 직무 종합 분석",
    status: "completed",
    createdAt: "2026-04-06T09:00:00Z",
    experienceCount: 3,
    summaryText: "기획 경험 간 연결이 약합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
    selectedExperienceIds: ["exp-v2-2", "ind-3", "ind-4"],
  },
  {
    id: "comp-3",
    type: "comprehensive",
    title: "리더십 경험 종합 분석",
    status: "completed",
    createdAt: "2026-04-02T14:00:00Z",
    experienceCount: 3,
    summaryText: "리더십 역량이 시간순으로 성장하는 패턴이 보입니다.",
    overallConfidence: "sufficient",
    isBookmarked: false,
    selectedExperienceIds: ["exp-v2-2", "ind-4", "ind-6"],
  },
  {
    id: "comp-4",
    type: "comprehensive",
    title: "커뮤니케이션 역량 종합 분석",
    status: "processing",
    createdAt: "2026-04-10T08:00:00Z",
    experienceCount: 5,
    summaryText: "",
    overallConfidence: "insufficient",
    isBookmarked: false,
  },
];

export const mockComprehensiveResult: ComprehensiveAnalysisResult = {
  id: "comp-1",
  title: "개발 직무 종합 분석",
  analyzedAt: "2026-04-08T12:00:00Z",
  isBookmarked: true,
  overallConfidence: "sufficient",
  selectedExperienceIds: ["exp-v2-1", "exp-v2-3", "ind-5"],
  experienceSummaries: [
    {
      experienceId: "exp-v2-1",
      title: "카카오 프론트엔드 인턴십",
      summary: "실무 환경에서 성능 최적화와 컴포넌트 아키텍처를 주도한 핵심 경험",
      highlight: "렌더링 속도 40% 개선, 팀 생산성 30% 향상",
      role: "primary",
      importance: 5,
    },
    {
      experienceId: "exp-v2-3",
      title: "캡스톤 디자인 프로젝트",
      summary: "팀 리더로서 서비스 기획부터 프로토타입까지 총괄한 프로젝트",
      highlight: "6인 팀 리더, 프로토타입 완성",
      role: "primary",
      importance: 4,
    },
    {
      experienceId: "ind-5",
      title: "UX 리서치 프로젝트",
      summary: "사용자 인터뷰 설계 및 분석을 통해 사용자 중심 사고를 보여준 경험",
      highlight: "인터뷰 12건 수행, 인사이트 도출",
      role: "supporting",
      importance: 3,
    },
  ],
  keywords: [
    {
      id: "ck-1",
      label: "프론트엔드 개발",
      category: "skill",
      confidence: "sufficient",
      evidences: [
        { quote: "React 프로파일러 기반 성능 최적화", experienceTitle: "카카오 프론트엔드 인턴십" },
        { quote: "프로토타입 프론트엔드 구현", experienceTitle: "캡스톤 디자인 프로젝트" },
      ],
    },
    {
      id: "ck-2",
      label: "리더십",
      category: "work_style",
      confidence: "partial",
      evidences: [
        { quote: "6인 팀 리더로서 총괄", experienceTitle: "캡스톤 디자인 프로젝트" },
      ],
    },
    {
      id: "ck-3",
      label: "사용자 중심 사고",
      category: "value",
      confidence: "partial",
      evidences: [
        { quote: "사용자 인터뷰 설계 및 분석을 주도", experienceTitle: "UX 리서치 프로젝트" },
      ],
    },
    {
      id: "ck-4",
      label: "문제 해결",
      category: "skill",
      confidence: "sufficient",
      evidences: [
        { quote: "렌더링 병목 분석 후 최적화", experienceTitle: "카카오 프론트엔드 인턴십" },
      ],
    },
  ],
  connections: [
    {
      fromExperienceId: "exp-v2-3",
      fromTitle: "캡스톤 디자인 프로젝트",
      toExperienceId: "exp-v2-1",
      toTitle: "카카오 프론트엔드 인턴십",
      connectionType: "temporal_growth",
      strength: "strong",
      evidence: {
        quote: "학교 프로젝트에서 쌓은 프론트엔드 기초가 실무 인턴십에서 성과로 이어짐",
        experienceTitle: "캡스톤 → 카카오",
      },
    },
    {
      fromExperienceId: "ind-5",
      fromTitle: "UX 리서치 프로젝트",
      toExperienceId: "exp-v2-1",
      toTitle: "카카오 프론트엔드 인턴십",
      connectionType: "role_expansion",
      strength: "weak",
      evidence: {
        quote: "UX 리서치 경험이 프론트엔드 개발에 미친 영향이 명시적으로 드러나지 않음",
        experienceTitle: "UX 리서치 → 카카오",
      },
      improvementGuide: {
        reason: "UX 리서치 경험과 프론트엔드 개발의 연결이 약합니다.",
        suggestion: "리서치 인사이트가 UI 개발에 영향을 준 사례를 추가해보세요.",
      },
    },
  ],
  storylines: [
    {
      id: "sl-1",
      start: "캡스톤 프로젝트에서 프론트엔드 개발에 처음 도전",
      development: "UX 리서치를 통해 사용자 관점을 학습하고, 프로토타입 개발 역량을 키움",
      evidence: "6인 팀 리더로서 서비스 기획부터 프로토타입까지 완성",
      growth: "카카오 인턴십에서 실무 성능 최적화와 아키텍처 설계를 주도",
      arrival: "프론트엔드 개발자로서 기술력과 협업 역량을 모두 갖춘 인재",
      coreExperienceIds: ["exp-v2-1", "exp-v2-3"],
      supportingExperienceIds: ["ind-5"],
    },
  ],
  scenarios: [
    {
      id: "sc-1",
      title: "IT 기업 프론트엔드 개발자",
      rationale: "실무 인턴 경험과 성능 최적화 성과가 직접적으로 어필됩니다.",
      recommendedExperienceIds: ["exp-v2-1", "exp-v2-3"],
      emphasisPoints: ["성능 40% 개선 수치", "컴포넌트 아키텍처 설계 경험"],
      speakingOrder: ["카카오 인턴십 → 캡스톤 프로젝트 → 기술 성장 스토리"],
    },
    {
      id: "sc-2",
      title: "UX 엔지니어",
      rationale: "프론트엔드 기술력 + UX 리서치 경험의 조합이 차별점이 됩니다.",
      recommendedExperienceIds: ["exp-v2-1", "ind-5"],
      emphasisPoints: ["사용자 인터뷰 경험", "성능 최적화를 통한 UX 개선"],
      speakingOrder: ["UX 리서치 → 카카오 인턴십 → 사용자 중심 개발"],
      fitComment: "UX 엔지니어 포지션은 아직 국내에서 채용이 적지만, 글로벌 IT 기업에서 수요가 증가하고 있습니다.",
    },
  ],
  commonRecommendations: [
    {
      id: "crec-1",
      activity: "기술 블로그 운영 시작",
      reason: "성능 최적화 사례를 글로 정리하면 기술 커뮤니케이션 역량도 증명할 수 있습니다.",
      evidence: { quote: "렌더링 속도 40% 개선", experienceTitle: "카카오 프론트엔드 인턴십" },
      expectedEffect: "포트폴리오 강화 + 기술 커뮤니티 참여",
      type: "expand",
    },
    {
      id: "crec-2",
      activity: "사이드 프로젝트로 풀스택 경험 추가",
      reason: "프론트엔드 외에 백엔드 이해도를 보여주면 기술 범위가 넓어집니다.",
      evidence: { quote: "프론트엔드 팀 내 성능 개선 태스크 전담", experienceTitle: "카카오 프론트엔드 인턴십" },
      expectedEffect: "풀스택 역량 증명",
      type: "supplement",
    },
    {
      id: "crec-3",
      activity: "협업 사례 구체화",
      reason: "코드 리뷰 참여 외에 팀원과의 의견 조율 사례가 있으면 협업 역량이 강화됩니다.",
      evidence: { quote: "코드 리뷰에서 긍정적 피드백", experienceTitle: "카카오 프론트엔드 인턴십" },
      expectedEffect: "팀워크 역량 근거 보강",
      type: "supplement",
    },
  ],
  scenarioRecommendations: [
    {
      id: "srec-1",
      activity: "프론트엔드 성능 모니터링 도구 활용 경험 추가",
      reason: "IT 기업에서 성능 모니터링은 필수 역량입니다.",
      evidence: { quote: "React 프로파일러로 병목 지점을 분석", experienceTitle: "카카오 프론트엔드 인턴십" },
      expectedEffect: "실무 성능 관리 역량 증명",
      type: "expand",
      scenarioId: "sc-1",
    },
    {
      id: "srec-2",
      activity: "사용성 테스트 참여 경험 추가",
      reason: "UX 엔지니어는 개발뿐 아니라 테스트 참여도 중요합니다.",
      evidence: { quote: "사용자 인터뷰 설계 및 분석을 주도", experienceTitle: "UX 리서치 프로젝트" },
      expectedEffect: "UX 리서치 → 개발 연결 역량 강화",
      type: "supplement",
      scenarioId: "sc-2",
    },
  ],
  confidenceGuide: {
    overallConfidence: "sufficient",
    improvementGuides: [
      {
        reason: "UX 리서치와 프론트엔드 개발의 연결이 약합니다.",
        suggestion: "리서치 인사이트가 개발에 영향을 준 구체적 사례를 추가하세요.",
        targetField: "내 역할/기여도",
      },
      {
        reason: "팀 내 갈등 해결이나 의견 조율 사례가 부족합니다.",
        suggestion: "협업 과정에서의 커뮤니케이션 경험을 기록해보세요.",
      },
    ],
  },
};

// ─── Keyword Analysis ───────────────────────────────────────

export const mockKeywordSuggestions: KeywordSuggestion[] = [
  { id: "ks-1", label: "문제 해결", category: "skill", reason: "3개 경험에서 문제 해결 패턴이 발견됨", relatedExperienceCount: 3 },
  { id: "ks-2", label: "데이터 분석", category: "skill", reason: "SQL, Python 활용 경험이 있음", relatedExperienceCount: 2 },
  { id: "ks-3", label: "자기주도성", category: "work_style", reason: "인턴과 프로젝트에서 주도적 행동 근거가 있음", relatedExperienceCount: 4 },
  { id: "ks-4", label: "팀워크", category: "work_style", reason: "다수의 팀 프로젝트 참여 이력", relatedExperienceCount: 5 },
  { id: "ks-5", label: "성장 지향", category: "value", reason: "시간순 역량 성장이 확인됨", relatedExperienceCount: 4 },
  { id: "ks-6", label: "IT/개발", category: "job_domain", reason: "프론트엔드 개발 중심의 경험 다수", relatedExperienceCount: 3 },
];

export const mockKeywordList: AnalysisSnapshot[] = [
  {
    id: "kw-1",
    type: "keyword",
    title: "'리더십 · 협업' 키워드 분석",
    status: "completed",
    createdAt: "2026-04-04T11:00:00Z",
    experienceCount: 5,
    summaryText: "리더십 키워드 부합도가 높으며, 협업은 보완이 필요합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
    selectedKeywords: ["리더십", "협업"],
  },
  {
    id: "kw-2",
    type: "keyword",
    title: "'문제 해결' 키워드 분석",
    status: "completed",
    createdAt: "2026-04-01T15:00:00Z",
    experienceCount: 3,
    summaryText: "문제 해결 역량이 충분히 증명됩니다.",
    overallConfidence: "sufficient",
    isBookmarked: true,
    selectedKeywords: ["문제 해결"],
  },
  {
    id: "kw-3",
    type: "keyword",
    title: "'데이터 분석 · 자기주도성' 키워드 분석",
    status: "completed",
    createdAt: "2026-03-28T10:00:00Z",
    experienceCount: 4,
    summaryText: "데이터 분석은 부분적, 자기주도성은 충분합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
    selectedKeywords: ["데이터 분석", "자기주도성"],
  },
];

export const mockKeywordResult: KeywordAnalysisResult = {
  id: "kw-1",
  title: "'리더십 · 협업' 키워드 분석",
  analyzedAt: "2026-04-04T11:00:00Z",
  isBookmarked: false,
  overallConfidence: "partial",
  selectedKeywords: ["리더십", "협업"],
  keywordDefinitions: [
    {
      keywordId: "kd-1",
      label: "리더십",
      category: "work_style",
      redefinition: "팀의 방향을 설정하고, 구성원의 역량을 이끌어내며 목표를 달성하는 능력",
      synonyms: ["팀 리딩", "의사결정", "비전 제시"],
      fitCriteria: [
        { id: "fc-1", description: "팀 목표 설정 및 공유 경험이 있는가" },
        { id: "fc-2", description: "구성원 역할 분배 및 조율 사례가 있는가" },
        { id: "fc-3", description: "갈등 상황에서 조율한 경험이 있는가" },
        { id: "fc-4", description: "팀 성과에 대한 책임을 진 사례가 있는가" },
      ],
    },
    {
      keywordId: "kd-2",
      label: "협업",
      category: "work_style",
      redefinition: "다양한 배경의 팀원들과 효과적으로 소통하며 공동 목표를 달성하는 능력",
      synonyms: ["팀워크", "커뮤니케이션", "협력"],
      fitCriteria: [
        { id: "fc-5", description: "역할 분담 후 상호 피드백을 교환한 경험이 있는가" },
        { id: "fc-6", description: "의견 차이를 조율한 구체적 사례가 있는가" },
        { id: "fc-7", description: "다른 직군과 협업한 경험이 있는가" },
        { id: "fc-8", description: "팀 내 소통 문화 개선에 기여한 사례가 있는가" },
      ],
    },
  ],
  selectionCriteria:
    "선택된 키워드('리더십', '협업')와 관련된 행동, 성과, 역할 기술이 포함된 경험을 우선 선별했습니다. 단순 참여 언급보다 구체적 행동과 결과가 있는 경험에 높은 가중치를 부여했습니다.",
  coverage: [
    { keywordId: "kd-1", label: "리더십", matchedCount: 4, totalCount: 12 },
    { keywordId: "kd-2", label: "협업", matchedCount: 5, totalCount: 12 },
  ],
  matchedExperiences: [
    { keywordId: "kd-1", experienceId: "exp-v2-2", title: "캡스톤 디자인 프로젝트", fitScore: 85, evidence: { quote: "6인 팀 리더로서 서비스 기획부터 프로토타입까지 총괄", experienceTitle: "캡스톤 디자인 프로젝트" }, matchedCriteriaIds: ["fc-1", "fc-2", "fc-4"] },
    { keywordId: "kd-1", experienceId: "ind-4", title: "교내 창업 경진대회", fitScore: 72, evidence: { quote: "팀장으로서 비즈니스 모델 기획을 주도", experienceTitle: "교내 창업 경진대회" }, matchedCriteriaIds: ["fc-1", "fc-4"] },
    { keywordId: "kd-1", experienceId: "ind-6", title: "동아리 운영 경험", fitScore: 45, evidence: { quote: "동아리 회장으로서 운영을 담당", experienceTitle: "동아리 운영 경험" }, matchedCriteriaIds: ["fc-1"] },
    { keywordId: "kd-2", experienceId: "exp-v2-1", title: "카카오 프론트엔드 인턴십", fitScore: 68, evidence: { quote: "코드 리뷰에 적극 참여하며 팀원과 소통", experienceTitle: "카카오 프론트엔드 인턴십" }, matchedCriteriaIds: ["fc-5", "fc-7"] },
    { keywordId: "kd-2", experienceId: "exp-v2-2", title: "캡스톤 디자인 프로젝트", fitScore: 78, evidence: { quote: "6인 팀에서 역할 분배 및 주간 회의 운영", experienceTitle: "캡스톤 디자인 프로젝트" }, matchedCriteriaIds: ["fc-5", "fc-6", "fc-7"] },
    { keywordId: "kd-2", experienceId: "ind-5", title: "UX 리서치 프로젝트", fitScore: 55, evidence: { quote: "디자이너와 개발자 간 인사이트 공유 세션 진행", experienceTitle: "UX 리서치 프로젝트" }, matchedCriteriaIds: ["fc-7"] },
  ],
  storylines: [
    {
      id: "ksl-1",
      start: "동아리 운영에서 처음으로 팀을 이끄는 경험",
      development: "캡스톤 프로젝트에서 본격적인 팀 리더십을 발휘하고, 다양한 역할 조율을 경험",
      evidence: "6인 팀 리더로서 역할 분배, 갈등 조율, 최종 발표까지 총괄",
      growth: "카카오 인턴십에서 실무 환경의 협업 문화를 체험하고 코드 리뷰 참여",
      arrival: "리더십과 협업 모두를 갖춘 팀 플레이어",
      coreExperienceIds: ["exp-v2-2", "exp-v2-1"],
      supportingExperienceIds: ["ind-6", "ind-5"],
    },
  ],
  fitEvaluations: [
    {
      keywordId: "kd-1",
      label: "리더십",
      totalScore: 72,
      axes: { specificity: 18, actionClarity: 20, impactStrength: 17, consistency: 17 },
      strongEvidences: [
        { quote: "6인 팀 리더로서 서비스 기획부터 프로토타입까지 총괄", experienceTitle: "캡스톤 디자인 프로젝트" },
      ],
      weakEvidences: [
        { quote: "동아리 회장으로서 운영을 담당", experienceTitle: "동아리 운영 경험" },
      ],
      missingEvidences: ["갈등 상황에서 구체적으로 조율한 사례"],
    },
    {
      keywordId: "kd-2",
      label: "협업",
      totalScore: 58,
      axes: { specificity: 14, actionClarity: 15, impactStrength: 12, consistency: 17 },
      strongEvidences: [
        { quote: "6인 팀에서 역할 분배 및 주간 회의 운영", experienceTitle: "캡스톤 디자인 프로젝트" },
      ],
      weakEvidences: [
        { quote: "코드 리뷰에 적극 참여", experienceTitle: "카카오 프론트엔드 인턴십" },
      ],
      missingEvidences: ["의견 차이를 조율한 구체적 사례", "팀 소통 문화 개선 기여 사례"],
    },
  ],
  improvementGuides: [
    {
      reason: "협업의 구체적인 소통 사례가 부족합니다.",
      suggestion: "의견 충돌을 해결한 경험이나 팀 소통 방식을 개선한 사례를 추가하세요.",
      targetField: "내 역할/기여도",
    },
    {
      reason: "리더십에서 갈등 조율 사례가 부족합니다.",
      suggestion: "팀원 간 의견이 갈렸을 때 어떻게 조율했는지 구체적으로 기록해보세요.",
    },
  ],
  commonRecommendations: [
    {
      id: "krec-1",
      activity: "팀 프로젝트에서 회고 세션 운영",
      reason: "리더십과 협업 모두를 증명할 수 있는 활동입니다.",
      evidence: { quote: "주간 회의 운영", experienceTitle: "캡스톤 디자인 프로젝트" },
      expectedEffect: "팀 소통 역량 증명 + 리더십 근거 강화",
      type: "expand",
    },
  ],
  keywordRecommendations: [
    {
      id: "krec-2",
      activity: "멘토링 활동 참여",
      reason: "리더십의 '구성원 성장 지원' 측면을 보강할 수 있습니다.",
      evidence: { quote: "팀 리더로서 역할 분배", experienceTitle: "캡스톤 디자인 프로젝트" },
      expectedEffect: "리더십 키워드 부합도 상승",
      type: "supplement",
    },
    {
      id: "krec-3",
      activity: "타 직군 협업 프로젝트 참여",
      reason: "협업 키워드의 '다양한 배경과의 소통' 기준을 강화합니다.",
      evidence: { quote: "디자이너와 개발자 간 인사이트 공유", experienceTitle: "UX 리서치 프로젝트" },
      expectedEffect: "협업 키워드 부합도 상승",
      type: "expand",
    },
  ],
};

// ─── Bookmarks ──────────────────────────────────────────────

export const mockBookmarks: BookmarkedSnapshot[] = [
  { ...mockIndividualAnalysisList[0], bookmarkedAt: "2026-04-09T15:00:00Z" },
  { ...mockIndividualAnalysisList[4], bookmarkedAt: "2026-04-02T12:00:00Z" },
  { ...mockComprehensiveList[0], bookmarkedAt: "2026-04-08T13:00:00Z" },
  { ...mockComprehensiveList[2], bookmarkedAt: "2026-04-03T10:00:00Z" },
  { ...mockKeywordList[1], bookmarkedAt: "2026-04-01T16:00:00Z" },
];

// ─── History ────────────────────────────────────────────────

export const mockHistory: AnalysisSnapshot[] = [
  ...mockIndividualAnalysisList.filter((s) => s.status === "completed"),
  ...mockComprehensiveList.filter((s) => s.status === "completed"),
  ...mockKeywordList,
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

// ─── Selectable Experiences (for new analysis) ──────────────

export const mockSelectableExperiences = [
  { id: "exp-v2-1", title: "카카오 프론트엔드 인턴십", type: "career", importance: 5 as const, isComplete: true },
  { id: "exp-v2-2", title: "캡스톤 디자인 프로젝트", type: "personal-project", importance: 4 as const, isComplete: true },
  { id: "exp-v2-3", title: "데이터 분석 대외활동", type: "activity", importance: 3 as const, isComplete: true },
  { id: "exp-v2-4", title: "교내 창업 경진대회 금상", type: "competition", importance: 4 as const, isComplete: true },
  { id: "exp-v2-5", title: "UX 리서치 프로젝트", type: "personal-project", importance: 3 as const, isComplete: true },
  { id: "exp-v2-6", title: "동아리 운영 경험", type: "activity", importance: 2 as const, isComplete: false },
  { id: "exp-v2-7", title: "해외 봉사활동", type: "activity", importance: 2 as const, isComplete: false },
  { id: "exp-v2-8", title: "오픈소스 컨트리뷰션", type: "personal-project", importance: 3 as const, isComplete: true },
  { id: "exp-v2-9", title: "SQLD 자격증 취득", type: "certification", importance: 2 as const, isComplete: true },
  { id: "exp-v2-10", title: "마케팅 인턴십", type: "career", importance: 3 as const, isComplete: true },
  { id: "exp-v2-11", title: "코딩 부트캠프 수료", type: "education", importance: 3 as const, isComplete: true },
  { id: "exp-v2-12", title: "학생회 활동", type: "activity", importance: 2 as const, isComplete: true },
];
