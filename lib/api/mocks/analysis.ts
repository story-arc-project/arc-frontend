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
  status: "completed",
  experienceId: "exp-v2-1",
  result: {
    status: "completed",
    itemName: "카카오 프론트엔드 인턴십",
    itemType: "career",
    briefSummary:
      "6개월간 카카오에서 프론트엔드 인턴으로 근무하며, 신규 기능 개발과 성능 최적화를 주도한 경험입니다. 실무 환경에서의 협업 역량과 기술 성장이 잘 드러납니다.",
    deepAnalysis: {
      careerValue:
        "실제 트래픽이 많은 서비스에서 성능 개선을 주도한 경험은 중·대형 서비스 프론트엔드 직무에 직접적인 가치를 가집니다.",
      strengths: [
        "성능 병목을 정량적으로 측정하고 개선한 경험",
        "재사용 가능한 컴포넌트 라이브러리를 설계한 시스템적 사고",
        "코드 리뷰 문화에 적극 참여하며 협업한 이력",
      ],
      limitations: [
        "협업 과정에서 의견 충돌을 조율한 구체적 사례가 부족",
        "성능 최적화 후 사용자 행동 변화에 대한 후속 분석 미기재",
      ],
      applicableRoles: ["프론트엔드 엔지니어", "UX 엔지니어", "퍼포먼스 엔지니어"],
      marketValue:
        "성능 최적화·아키텍처 설계 경험은 시니어 주니어 사이의 차별 포인트로 작용해 IT 대기업 및 스타트업 모두에서 가산점이 됩니다.",
    },
    starFormat: {
      title: "주요 페이지 성능 40% 개선",
      situation: "주요 페이지 렌더링 속도가 3초 이상으로 사용자 이탈률이 증가하던 상황",
      task: "성능 병목을 식별하고 페이지 로딩 시간을 단축해야 함",
      action: "React 프로파일러로 병목 지점을 분석하고, 코드 스플리팅과 메모이제이션을 적용",
      result: "렌더링 속도 40% 개선, 사용자 이탈률 15% 감소",
    },
    itemDiagnosis: {
      oneLineVerdict:
        "정량적 성과는 매우 강하지만, 협업 맥락의 근거가 부족해 ‘기술 단독’ 이미지로 비칠 수 있어요.",
      weaknesses: [
        {
          id: "w-1",
          category: "협업 맥락",
          severity: "high",
          title: "팀과의 의사결정 과정이 보이지 않음",
          diagnosis: "성능 개선의 결정과 실행이 본인 단독으로만 서술돼 있어요.",
          evidence: "‘프로파일링 후 최적화를 적용’ 외에 팀과의 논의 흔적이 없음",
          impact: "협업 역량을 묻는 면접에서 이 경험만으로는 답하기 어려울 수 있어요.",
          priorityAction: "코드 리뷰·팀 회의에서 의견을 조율한 사례를 1~2줄 추가",
          improvementExample:
            "‘리더와 함께 우선순위 합의 → 팀 코드 리뷰에서 메모이제이션 전략 합의 → 단계적 배포’와 같이 의사결정 흐름을 적어보세요.",
        },
        {
          id: "w-2",
          category: "후속 분석",
          severity: "medium",
          title: "개선 후 사용자 행동 변화에 대한 해석 부족",
          diagnosis: "이탈률 15% 감소가 어떤 사용자 행동 변화로 이어졌는지에 대한 서술이 없어요.",
          evidence: "수치만 기재되어 있고 해석이 빠져 있음",
          impact: "성과의 의미가 ‘숫자 자랑’에 머무를 수 있음",
          priorityAction: "이탈률 감소 → 전환률·세션 길이에 미친 영향 한 줄 추가",
          improvementExample:
            "‘이탈률 15%↓ → 평균 세션 길이 1.4배 증가, 결제 페이지 진입률 8%↑’",
        },
      ],
      missingElements: ["팀 규모 및 본인 포지션", "성능 개선 후 모니터링 체계"],
      rewriteSuggestion:
        "‘React 프로파일러로 LCP 3.2초의 원인을 식별하고, 팀 리뷰를 거쳐 코드 스플리팅·메모이제이션을 단계적으로 적용. 결과적으로 LCP 40%↓, 이탈률 15%↓, 결제 페이지 진입률 8%↑를 달성했습니다.’",
    },
    synergyRecommendations: [
      {
        priority: "high",
        category: "포트폴리오",
        name: "성능 최적화 사례 기술 블로그 정리",
        reason: "구체적 수치와 방법론이 있어 설득력 있는 콘텐츠가 됩니다.",
        expectedEffect: "기술 커뮤니케이션 역량 증명 + 포트폴리오 강화",
        estimatedDuration: "2주",
      },
      {
        priority: "medium",
        category: "오픈소스",
        name: "오픈소스 성능 PR 기여",
        reason: "실무 경험을 외부에서 검증할 수 있는 좋은 방법입니다.",
        expectedEffect: "기술 역량의 외부 검증 + 커뮤니티 노출",
        estimatedDuration: "1개월",
      },
      {
        priority: "low",
        category: "협업",
        name: "팀 회고 기록 정리",
        reason: "협업 사례가 부족한 점을 보완할 수 있습니다.",
        expectedEffect: "협업 역량 근거 강화",
        estimatedDuration: "1주",
      },
    ],
    actionPlan: {
      shortTerm: "코드 리뷰·팀 회의 사례를 본 이력의 ‘내 역할’에 1~2줄 보완",
      midTerm: "기술 블로그에 성능 최적화 회고 글 1편 발행",
      longTerm: "오픈소스 성능 관련 PR 기여로 외부 검증 이력 확보",
    },
    missingInfoWarning:
      "팀 규모/직책, 모니터링 체계 등 일부 맥락 정보가 누락되어 있어 추가 입력 시 정확도가 더 높아져요.",
  },
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
  status: "completed",
  analysisDate: "2026-04-04T11:00:00Z",
  keywords: ["리더십", "협업"],
  targetScenario: "IT 서비스 기업 신입 프로덕트 매니저 지원",
  keywordDefinitions: [
    {
      keyword: "리더십",
      definition: "팀의 방향을 설정하고, 구성원의 역량을 이끌어내며 목표를 달성하는 능력",
      synonyms: ["팀 리딩", "의사결정", "비전 제시"],
      complianceCriteria: [
        "팀 목표 설정 및 공유 경험이 있는가",
        "구성원 역할 분배 및 조율 사례가 있는가",
        "갈등 상황에서 조율한 경험이 있는가",
        "팀 성과에 대한 책임을 진 사례가 있는가",
      ],
    },
    {
      keyword: "협업",
      definition: "다양한 배경의 팀원들과 효과적으로 소통하며 공동 목표를 달성하는 능력",
      synonyms: ["팀워크", "커뮤니케이션", "협력"],
      complianceCriteria: [
        "역할 분담 후 상호 피드백을 교환한 경험이 있는가",
        "의견 차이를 조율한 구체적 사례가 있는가",
        "다른 직군과 협업한 경험이 있는가",
        "팀 내 소통 문화 개선에 기여한 사례가 있는가",
      ],
    },
  ],
  selectionCriteria: {
    summary:
      "선택된 키워드('리더십', '협업')와 관련된 행동, 성과, 역할 기술이 포함된 경험을 우선 선별했습니다.",
    criteria: [
      "단순 참여 언급보다 구체적 행동과 결과가 있는 경험에 높은 가중치 부여",
      "팀 단위(2인 이상) 활동에 가산점 부여",
      "타겟 시나리오와 직무 적합성이 보이는 경험 우선",
    ],
  },
  coverage: [
    { keyword: "리더십", relatedCount: 4, totalCount: 12, coveragePercent: 33 },
    { keyword: "협업", relatedCount: 5, totalCount: 12, coveragePercent: 42 },
  ],
  matchedExperiences: [
    {
      keyword: "리더십",
      experiences: [
        {
          careerTitle: "캡스톤 디자인 프로젝트",
          organization: "한양대학교",
          period: "2024.03 - 2024.06",
          relevance: "6인 팀 리더로서 기획부터 프로토타입까지 총괄한 경험으로, 리더십 핵심 기준 다수를 충족",
          evidence: [
            {
              type: "행동",
              content: "팀원 6인의 역할을 기획·디자인·개발로 나누고 주간 회의를 운영",
              sourceQuote: "6인 팀 리더로서 서비스 기획부터 프로토타입까지 총괄",
            },
            {
              type: "성과",
              content: "발표 평가에서 학과 내 상위 3팀에 선정",
              sourceQuote: "최종 발표에서 우수상 수상",
            },
          ],
          matchedCriteria: [
            "팀 목표 설정 및 공유 경험이 있는가",
            "구성원 역할 분배 및 조율 사례가 있는가",
            "팀 성과에 대한 책임을 진 사례가 있는가",
          ],
          confidence: "high",
          confidenceReason: "복수의 정량적 근거와 역할 기술이 함께 제시됨",
        },
        {
          careerTitle: "교내 창업 경진대회",
          organization: "교내 창업지원단",
          period: "2023.09 - 2023.12",
          relevance: "팀장으로서 비즈니스 모델 기획을 주도",
          evidence: [
            {
              type: "행동",
              content: "비즈니스 모델 캔버스를 직접 작성하고 팀원과 합의 후 발표 자료 총괄",
              sourceQuote: "팀장으로서 비즈니스 모델 기획을 주도",
            },
          ],
          matchedCriteria: [
            "팀 목표 설정 및 공유 경험이 있는가",
            "팀 성과에 대한 책임을 진 사례가 있는가",
          ],
          confidence: "medium",
          confidenceReason: "리더 역할은 명확하나 갈등 조율 사례가 부족",
        },
      ],
    },
    {
      keyword: "협업",
      experiences: [
        {
          careerTitle: "캡스톤 디자인 프로젝트",
          organization: "한양대학교",
          period: "2024.03 - 2024.06",
          relevance: "기획·디자인·개발 직군이 섞인 팀에서 의견 조율과 피드백 교환을 주도",
          evidence: [
            {
              type: "행동",
              content: "주간 회의에서 디자인-개발 간 의견 차이를 조율",
              sourceQuote: "6인 팀에서 역할 분배 및 주간 회의 운영",
            },
          ],
          matchedCriteria: [
            "역할 분담 후 상호 피드백을 교환한 경험이 있는가",
            "의견 차이를 조율한 구체적 사례가 있는가",
            "다른 직군과 협업한 경험이 있는가",
          ],
          confidence: "high",
          confidenceReason: "다직군 협업 + 의견 조율 사례가 모두 확인됨",
        },
        {
          careerTitle: "카카오 프론트엔드 인턴십",
          organization: "카카오",
          period: "2024.07 - 2024.12",
          relevance: "코드 리뷰 문화에 적극 참여",
          evidence: [
            {
              type: "행동",
              content: "팀 코드 리뷰에서 의견을 정리해 PR로 반영",
              sourceQuote: "코드 리뷰에 적극 참여하며 팀원과 소통",
            },
          ],
          matchedCriteria: [
            "역할 분담 후 상호 피드백을 교환한 경험이 있는가",
            "다른 직군과 협업한 경험이 있는가",
          ],
          confidence: "medium",
          confidenceReason: "협업 사례가 코드 리뷰에 한정되어 있음",
        },
      ],
    },
  ],
  storylines: [
    {
      keyword: "리더십",
      storylineTitle: "동아리 운영 → 캡스톤 리더 → 실무 협업으로 이어진 리더십 성장",
      structure: {
        start: "동아리 운영에서 처음으로 팀을 이끌게 된 계기",
        development: "캡스톤 프로젝트에서 6인 팀의 리더 역할을 수행하며 의견 조율과 일정 관리에 도전",
        evidence: "주간 회의 운영, 역할 분배, 갈등 조율, 최종 발표까지 직접 주도",
        growth: "카카오 인턴십에서 실무 협업 문화를 체험하고 코드 리뷰 의견을 적극 반영",
        destination: "리더십과 협업을 모두 증명할 수 있는 팀 플레이어로 성장",
      },
      usedExperiences: {
        core: ["캡스톤 디자인 프로젝트", "카카오 프론트엔드 인턴십"],
        supporting: ["동아리 운영 경험"],
      },
      keyQuotes: [
        "6인 팀 리더로서 서비스 기획부터 프로토타입까지 총괄",
        "코드 리뷰에 적극 참여하며 팀원과 소통",
      ],
    },
  ],
  improvementGuide: {
    informationEnhancement: [
      "갈등 상황에서 어떻게 조율했는지 구체적인 대화 사례 추가",
      "팀 회의의 의사결정 결과가 프로젝트에 미친 영향 한 줄 보강",
    ],
    experienceExpansion: [
      "타 직군과의 협업 프로젝트 1건 추가",
      "팀 소통 문화 개선 기여 사례 정리",
    ],
    keywordSpecificRecommendations: [
      {
        keyword: "리더십",
        description: "멘토링 활동에 참여해 ‘구성원 성장 지원’ 측면을 보강하세요.",
      },
      {
        keyword: "협업",
        description: "타 직군이 포함된 사이드 프로젝트에 참여해 다배경 협업 사례를 늘리세요.",
      },
    ],
  },
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
