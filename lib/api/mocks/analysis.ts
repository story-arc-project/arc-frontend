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
  status: "completed",
  userSchool: "한양대학교",
  userDepartment: "컴퓨터소프트웨어학부",
  briefSummary:
    "프론트엔드 개발과 UX 사고를 두 축으로 성장 흐름이 이어지는 포트폴리오. 정량적 성과는 강하나 협업 맥락 보강이 필요합니다.",
  detailedSummary:
    "캡스톤 → UX 리서치 → 카카오 인턴십으로 이어지는 일관된 성장 라인이 보입니다. 성능 최적화 등 정량적 성과는 매우 강한 반면, 다배경 팀과의 협업·갈등 조율 경험은 단편적입니다. 단기적으로는 본 이력의 협업 맥락을 보강하고, 중기적으로는 풀스택·UX 엔지니어로 확장 가능한 사이드 프로젝트를 시도해볼 만합니다.",
  keywordClustering: {
    personalityTendency: ["주도형", "분석형", "성장 지향"],
    coreCompetency: ["성능 최적화", "프론트엔드 아키텍처", "UX 리서치", "팀 리더십"],
    jobIndustry: ["IT 서비스 / 프론트엔드", "UX 엔지니어링", "프로덕트 엔지니어링"],
  },
  experienceInsights: {
    motivation:
      "사용자에게 직접 닿는 화면을 다루는 일에 강한 동기를 가지고 있으며, 측정 가능한 성과로 이어지는 작업을 선호합니다.",
    learningPoints:
      "프로파일링 기반 분석, 컴포넌트 아키텍처 설계, 사용자 인터뷰를 통한 정성 데이터 해석을 학습 포인트로 정리할 수 있습니다.",
  },
  synergyCombinations: [
    {
      combinationTitle: "성능 + UX 사고 결합",
      items: ["카카오 프론트엔드 인턴십", "UX 리서치 프로젝트"],
      synergyReason:
        "성능 최적화의 정량 성과와 사용자 인터뷰 정성 데이터를 결합해 ‘UX 엔지니어’ 직무에 강한 근거가 됩니다.",
      expectedEffect: "기술 + UX 양 측면 모두에서 신뢰도 상승",
      applicableRoles: ["UX 엔지니어", "프로덕트 엔지니어"],
    },
    {
      combinationTitle: "리더십 흐름 + 실무 협업",
      items: ["캡스톤 디자인 프로젝트", "카카오 프론트엔드 인턴십"],
      synergyReason:
        "학내 리더십 경험과 실무 협업 경험이 시간순으로 이어져 ‘성장하는 팀 플레이어’ 서사를 만듭니다.",
      expectedEffect: "리더십·협업 역량의 일관된 증명",
      applicableRoles: ["프론트엔드 엔지니어", "테크 리드 트랙"],
    },
  ],
  additionalRecommendations: {
    certifications: ["정보처리기사", "Google UX Design Professional Certificate"],
    clubsAndSocieties: ["GDSC", "Likelion 프론트엔드 트랙"],
    projectsAndContests: ["오픈소스 성능 PR", "교내 해커톤 출전", "토이 프로덕트 출시"],
  },
  resumeStarFormat: [
    {
      title: "주요 페이지 성능 40% 개선",
      situation: "주요 페이지 LCP가 3초를 넘어 이탈률이 증가하던 상황",
      task: "팀 합의 하에 성능 개선 단일 책임자로 LCP 단축",
      action: "React 프로파일러로 병목을 식별, 코드 스플리팅·메모이제이션 단계 적용",
      result: "LCP 40%↓, 이탈률 15%↓, 결제 페이지 진입률 8%↑",
    },
    {
      title: "공통 컴포넌트 라이브러리 설계",
      situation: "신규 대시보드 요청에 기존 구조로는 확장이 어려웠던 상황",
      task: "재사용 가능한 컴포넌트 아키텍처 설계 책임",
      action: "팀 리뷰를 거쳐 토큰·컴포넌트 API를 정의하고 점진 적용",
      result: "후속 기능 개발 시간 30% 단축, 팀 코드 리뷰 만족도 상승",
    },
  ],
  actionPlan: {
    shortTerm: "본 이력의 협업 사례를 보강하고, 정량 성과의 ‘해석’ 한 줄 추가",
    midTerm: "사이드 프로젝트로 풀스택·UX 엔지니어링 경험을 1건 확보",
    longTerm: "오픈소스 기여 + UX 엔지니어 포지션을 타겟으로 한 포트폴리오 정리",
  },
  criticalDiagnosis: {
    oneLineVerdict:
      "정량 성과 우수, 그러나 ‘다배경 팀과의 협업’ 근거가 약해 직무 인터뷰에서 약점이 될 수 있어요.",
    weaknesses: [
      {
        id: "cw-1",
        category: "협업 맥락",
        severity: "high",
        title: "다른 직군과의 협업 사례 부족",
        diagnosis: "디자이너·기획자와의 의사결정 흔적이 잘 드러나지 않습니다.",
        evidence: "본 포트폴리오 전반에서 ‘본인 단독’ 액션 위주로 서술됨",
        impact: "협업 역량 인터뷰에서 답변 폭이 좁아짐",
        priorityAction: "타 직군과의 의사결정·합의 사례를 1~2건 추가",
      },
      {
        id: "cw-2",
        category: "정량 해석",
        severity: "medium",
        title: "수치는 있으나 해석이 부족",
        diagnosis: "‘15% 감소’ 등의 수치가 사용자 행동 변화로 이어진 해석이 없음",
        evidence: "‘이탈률 15% 감소’ 단독 기재",
        impact: "수치가 자기자랑처럼 들릴 수 있음",
        priorityAction: "지표가 상위 비즈니스 지표에 어떤 영향을 줬는지 한 줄 추가",
      },
    ],
    missingExperienceTypes: ["타 직군 협업 프로젝트", "장기 운영 경험", "외부 팀 발표 경험"],
    contentQualityIssues: [
      {
        item: "‘성능 최적화’ 항목",
        issue: "도입한 기법은 명확하지만 의사결정 과정이 보이지 않음",
        improvementHint: "‘프로파일 → 후보 검토 → 팀 합의’ 흐름을 한 줄로 보강",
      },
      {
        item: "‘공통 컴포넌트 라이브러리’ 항목",
        issue: "팀 합의 과정이 빠져 있음",
        improvementHint: "디자이너와의 토큰 합의 사례를 추가",
      },
    ],
    competitorGap:
      "비슷한 학번·전공 후보군 대비 정량 성과는 상위권이지만, ‘다배경 협업’ 측면은 평균 수준입니다.",
  },
  validJobRecommendations: [
    {
      company: "토스",
      role: "프론트엔드 엔지니어 (신입)",
      deadline: "2026-05-31",
      whyMatch: "성능 최적화 성과와 컴포넌트 아키텍처 설계 경험이 직접 연결됩니다.",
      url: "https://example.com/jobs/toss-fe",
    },
    {
      company: "당근",
      role: "프론트엔드 엔지니어 (주니어)",
      deadline: "2026-06-15",
      whyMatch: "팀 리더십과 실무 협업 경험이 사내 문화와 잘 맞을 가능성이 높아요.",
      url: "https://example.com/jobs/karrot-fe",
    },
  ],
  missingInfoWarning:
    "팀 규모, 본인 직책, 모니터링 체계 등 일부 정보가 빠져 있어 채워주시면 정확도가 더 올라갑니다.",
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
