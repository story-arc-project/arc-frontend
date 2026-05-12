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
// analysisCompleted = 5(개인) + 2(종합) + 3(키워드) = 10

export const mockAnalysisHomeSummary: AnalysisHomeSummary = {
  stats: {
    totalExperiences: 5,
    analysisCompleted: 10,
    lastAnalysisAt: "2026-05-08T14:30:00Z",
    improvementNeeded: 2,
  },
  recentIndividual: [
    {
      id: "ind-1",
      type: "individual",
      title: "LLM 주가 예측 프로젝트 분석",
      status: "completed",
      createdAt: "2026-05-08T14:30:00Z",
      experienceCount: 1,
      summaryText: "AI 기술 활용 역량과 공학적 문제 해결 능력이 잘 드러나는 경험입니다.",
      overallConfidence: "sufficient",
      isBookmarked: true,
    },
    {
      id: "ind-3",
      type: "individual",
      title: "네이버 부스트캠프 AI Tech 6기 분석",
      status: "completed",
      createdAt: "2026-05-06T10:00:00Z",
      experienceCount: 1,
      summaryText: "딥러닝 실무 역량과 팀 협업 경험이 인상적이나, 개인 기여 부분 구체화가 필요합니다.",
      overallConfidence: "partial",
      isBookmarked: false,
    },
    {
      id: "ind-4",
      type: "individual",
      title: "NLP 연구실 학부 인턴 분석",
      status: "completed",
      createdAt: "2026-05-04T16:00:00Z",
      experienceCount: 1,
      summaryText: "연구 환경 적응력과 데이터 품질 관리 역량이 드러납니다.",
      overallConfidence: "sufficient",
      isBookmarked: false,
    },
  ],
  recentComprehensive: [
    {
      id: "comp-1",
      type: "comprehensive",
      title: "AI/ML 개발 직무 종합 분석",
      status: "completed",
      createdAt: "2026-05-07T12:00:00Z",
      experienceCount: 3,
      summaryText: "AI/ML 기술 역량의 일관된 성장 흐름이 확인됩니다.",
      overallConfidence: "sufficient",
      isBookmarked: true,
    },
    {
      id: "comp-2",
      type: "comprehensive",
      title: "데이터 분석 직무 종합 분석",
      status: "completed",
      createdAt: "2026-05-05T09:00:00Z",
      experienceCount: 2,
      summaryText: "SQL·시각화 역량은 충분하나 비즈니스 도메인 이해도 보강이 필요합니다.",
      overallConfidence: "partial",
      isBookmarked: false,
    },
  ],
  recentKeyword: [
    {
      id: "kw-1",
      type: "keyword",
      title: "'문제 해결 · 자기주도성' 키워드 분석",
      status: "completed",
      createdAt: "2026-05-03T11:00:00Z",
      experienceCount: 4,
      summaryText: "자기주도성 부합도가 매우 높으며, 문제 해결은 사례 구체화가 필요합니다.",
      overallConfidence: "partial",
      isBookmarked: false,
      selectedKeywords: ["문제 해결", "자기주도성"],
    },
    {
      id: "kw-2",
      type: "keyword",
      title: "'AI · 딥러닝' 키워드 분석",
      status: "completed",
      createdAt: "2026-05-01T15:00:00Z",
      experienceCount: 3,
      summaryText: "AI/딥러닝 역량이 충분히 증명됩니다.",
      overallConfidence: "sufficient",
      isBookmarked: true,
      selectedKeywords: ["AI", "딥러닝"],
    },
    {
      id: "kw-3",
      type: "keyword",
      title: "'데이터 분석 · 연구' 키워드 분석",
      status: "completed",
      createdAt: "2026-04-28T10:00:00Z",
      experienceCount: 3,
      summaryText: "데이터 분석은 충분, 연구 역량은 부분적으로 증명됩니다.",
      overallConfidence: "partial",
      isBookmarked: false,
      selectedKeywords: ["데이터 분석", "연구"],
    },
  ],
  recommendations: {
    experienceGroups: [
      {
        experienceIds: ["exp-v2-1", "exp-v2-3"],
        reason: "LLM 프로젝트와 부스트캠프 경험을 묶으면 AI/ML 기술 성장 스토리를 만들 수 있어요.",
      },
      {
        experienceIds: ["exp-v2-4", "exp-v2-5"],
        reason: "연구실 인턴과 데이터 분석 프로젝트를 연결하면 데이터 중심 사고력을 증명할 수 있어요.",
      },
    ],
    suggestedKeywords: [
      { id: "sk-1", label: "문제 해결", category: "skill", reason: "4개 경험에서 문제 해결 패턴이 발견됨", relatedExperienceCount: 4 },
      { id: "sk-2", label: "자기주도성", category: "work_style", reason: "개인 프로젝트와 연구 참여에서 주도적 행동 근거가 있음", relatedExperienceCount: 3 },
      { id: "sk-3", label: "성장 지향", category: "value", reason: "시간순 역량 성장(부스트캠프 → 연구실 → 개인 프로젝트)이 확인됨", relatedExperienceCount: 5 },
    ],
  },
};

// ─── Individual Analysis ────────────────────────────────────

export const mockIndividualAnalysisList: AnalysisSnapshot[] = [
  {
    id: "ind-1",
    type: "individual",
    title: "LLM 주가 예측 프로젝트",
    status: "completed",
    createdAt: "2026-05-08T14:30:00Z",
    experienceCount: 1,
    summaryText: "AI 기술 활용 역량과 공학적 문제 해결 능력이 잘 드러나는 경험입니다.",
    overallConfidence: "sufficient",
    isBookmarked: true,
  },
  {
    id: "ind-2",
    type: "individual",
    title: "스마트 버스 알리미 앱 개발",
    status: "completed",
    createdAt: "2026-05-07T10:00:00Z",
    experienceCount: 1,
    summaryText: "팀 협업 역량과 외부 API 연동 경험이 드러나나, 개인 기여 부분 구체화가 필요합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
  },
  {
    id: "ind-3",
    type: "individual",
    title: "네이버 부스트캠프 AI Tech 6기",
    status: "completed",
    createdAt: "2026-05-06T10:00:00Z",
    experienceCount: 1,
    summaryText: "딥러닝 실무 역량과 팀 협업 경험이 인상적이나, 개인 기여 부분 구체화가 필요합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
  },
  {
    id: "ind-4",
    type: "individual",
    title: "NLP 연구실 학부 인턴",
    status: "completed",
    createdAt: "2026-05-04T16:00:00Z",
    experienceCount: 1,
    summaryText: "연구 환경 적응력과 데이터 품질 관리 역량이 드러납니다.",
    overallConfidence: "sufficient",
    isBookmarked: false,
  },
  {
    id: "ind-5",
    type: "individual",
    title: "이커머스 매출 데이터 분석",
    status: "completed",
    createdAt: "2026-05-02T12:00:00Z",
    experienceCount: 1,
    summaryText: "SQL과 시각화 역량이 충분히 증명되나, 비즈니스 인사이트 깊이 보강이 필요합니다.",
    overallConfidence: "partial",
    isBookmarked: true,
  },
];

export const mockIndividualAnalysisResult: IndividualAnalysisResult = {
  id: "ind-1",
  status: "completed",
  experienceId: "exp-v2-1",
  result: {
    status: "completed",
    itemName: "LLM 활용 뉴스 감성 분석 기반 하이브리드 주가 예측 프로젝트",
    itemType: "personal-project",
    briefSummary:
      "Gemma-2 LLM으로 뉴스 감성을 수치화하고 SMA 기술 지표와 결합한 하이브리드 매매 전략을 설계·구현한 개인 프로젝트입니다. AI 기술의 실세계 금융 적용 역량과 공학적 문제 해결 방식이 잘 드러납니다.",
    deepAnalysis: {
      careerValue:
        "비정형 텍스트 데이터를 정량 지표로 변환하는 NLP 파이프라인 경험은 AI/ML 엔지니어, 퀀트 리서처, 데이터 사이언티스트 직무에 직접적인 가치를 가집니다.",
      strengths: [
        "LLM 추론 파이프라인 설계 및 환각 방지 기법 적용 경험",
        "외부 API(Google News RSS, yfinance) 연동과 데이터 전처리를 독립적으로 수행",
        "백테스팅을 통한 정량적 전략 검증 방법론 보유",
      ],
      limitations: [
        "실제 투자 환경(슬리피지, 거래 비용)을 반영한 현실적 검증 미비",
        "단일 종목·단기 데이터 실험으로 일반화 가능성 논의가 부족",
      ],
      applicableRoles: ["ML 엔지니어", "데이터 사이언티스트", "퀀트 리서처"],
      marketValue:
        "LLM 활용 경험은 AI 서비스 개발 직군 전반에서 가산점이 되며, 금융 데이터 분석 경험은 핀테크·자산운용사 등 금융 IT 직무에서 차별화 포인트가 됩니다.",
    },
    starFormat: {
      title: "AI 기반 하이브리드 매매 전략 설계 및 백테스팅",
      situation: "개인 투자자가 뉴스 정보를 객관적으로 정량화하기 어려운 상황",
      task: "LLM 감성 점수와 기술 지표를 결합한 데이터 중심 매매 알고리즘 구현",
      action: "Gemma-2-2b-it로 뉴스 헤드라인 감성 점수화 → SMA 신호와 결합 → 손절/익절 규칙 포함 자동 시뮬레이션 구현",
      result: "전략 수익률 vs 시장 수익률 비교 백테스팅 완성 및 시각화 배포",
    },
    itemDiagnosis: {
      oneLineVerdict:
        "기술 구현력은 뛰어나지만, 실험의 한계와 일반화 가능성에 대한 자기 비판적 서술이 부족해 '연구 성숙도'가 낮게 보일 수 있어요.",
      weaknesses: [
        {
          id: "w-1",
          category: "실험 한계",
          severity: "high",
          title: "실전 투자 조건 미반영",
          diagnosis: "백테스팅 결과가 슬리피지, 거래 비용 등 현실 조건 없이 산출되어 있습니다.",
          evidence: "결과 수치에 거래 비용·슬리피지 가정이 명시되지 않음",
          impact: "실무 면접에서 '현실적 검증이 부족하다'는 지적을 받을 수 있어요.",
          priorityAction: "실험 조건(가정)을 명시하고, 한계 1~2줄 추가",
          improvementExample:
            "'거래 비용 0.1% 가정하에 백테스팅 진행, 실제 시장 적용 시 결과가 달라질 수 있음'",
        },
        {
          id: "w-2",
          category: "일반화",
          severity: "medium",
          title: "단일 종목 실험으로 일반화 근거 부족",
          diagnosis: "특정 종목·기간에 한정된 실험으로 전략의 범용성이 입증되지 않았습니다.",
          evidence: "실험 대상 종목 및 기간 범위가 제한적",
          impact: "전략의 신뢰도를 묻는 질문에 답하기 어려울 수 있음",
          priorityAction: "다양한 종목·기간으로 추가 검증 계획 언급",
          improvementExample:
            "'추후 KOSPI 상위 10개 종목·3개년 데이터로 확장 검증 예정'",
        },
      ],
      missingElements: ["실험 조건 명시(거래 비용·슬리피지 가정)", "비교 기준선(Buy & Hold 전략 대비 성능)"],
      rewriteSuggestion:
        "'Gemma-2 LLM으로 Google News 헤드라인을 감성 점수로 변환하고, SMA(20/60) 기술 지표와 결합해 매수 신호를 생성. 거래 비용 0.1% 가정 하에 백테스팅한 결과, Buy & Hold 전략 대비 X% 초과 수익을 확인했습니다(단, 단일 종목·3개월 기간 기준).'",
    },
    synergyRecommendations: [
      {
        priority: "high",
        category: "연구 확장",
        name: "다종목·다기간 백테스팅 확장",
        reason: "단일 종목 실험의 한계를 극복해 전략 신뢰도를 높일 수 있습니다.",
        expectedEffect: "논문·포트폴리오 완성도 향상",
        estimatedDuration: "3주",
      },
      {
        priority: "medium",
        category: "포트폴리오",
        name: "기술 블로그에 실험 회고 정리",
        reason: "방법론과 한계를 솔직하게 공유하면 연구 성숙도를 보여줄 수 있습니다.",
        expectedEffect: "기술 커뮤니티 노출 + 면접 화제 소재 확보",
        estimatedDuration: "1주",
      },
      {
        priority: "low",
        category: "네트워킹",
        name: "퀀트/AI 트레이딩 스터디 참여",
        reason: "비슷한 관심사의 개발자와 피드백을 교환하며 연구를 발전시킬 수 있습니다.",
        expectedEffect: "도메인 지식 심화",
        estimatedDuration: "지속",
      },
    ],
    actionPlan: {
      shortTerm: "실험 조건(가정)을 본 이력에 명시하고 Buy & Hold 기준선 비교 수치 추가",
      midTerm: "다종목·다기간 백테스팅으로 전략 일반화 검증 후 GitHub 공개",
      longTerm: "퀀트/AI 관련 논문 또는 캐글 Competition 참여로 외부 검증 이력 확보",
    },
    missingInfoWarning:
      "실험 조건(가정), 비교 기준선, 종목·기간 범위 등 일부 맥락 정보가 누락되어 있어 추가 입력 시 정확도가 더 높아져요.",
  },
};

// ─── Comprehensive Analysis ─────────────────────────────────

export const mockComprehensiveList: AnalysisSnapshot[] = [
  {
    id: "comp-1",
    type: "comprehensive",
    title: "AI/ML 개발 직무 종합 분석",
    status: "completed",
    createdAt: "2026-05-07T12:00:00Z",
    experienceCount: 3,
    summaryText: "AI/ML 기술 역량의 일관된 성장 흐름이 확인됩니다.",
    overallConfidence: "sufficient",
    isBookmarked: true,
    selectedExperienceIds: ["exp-v2-1", "exp-v2-3", "exp-v2-4"],
  },
  {
    id: "comp-2",
    type: "comprehensive",
    title: "데이터 분석 직무 종합 분석",
    status: "completed",
    createdAt: "2026-05-05T09:00:00Z",
    experienceCount: 2,
    summaryText: "SQL·시각화 역량은 충분하나 비즈니스 도메인 이해도 보강이 필요합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
    selectedExperienceIds: ["exp-v2-4", "exp-v2-5"],
  },
  {
    id: "comp-3",
    type: "comprehensive",
    title: "팀 협업 역량 종합 분석",
    status: "processing",
    createdAt: "2026-05-09T08:00:00Z",
    experienceCount: 3,
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
    "LLM·딥러닝·NLP 연구를 일관된 흐름으로 쌓아온 AI/ML 특화 포트폴리오. 기술 구현력은 강하나 실험 한계 인식과 팀 협업 맥락 보강이 필요합니다.",
  detailedSummary:
    "부스트캠프 수료 → NLP 연구실 인턴 → LLM 개인 프로젝트로 이어지는 AI/ML 성장 라인이 뚜렷합니다. 각 경험에서 정량적 성과(mAP 0.68, IAA 0.78, 백테스팅 완성)를 제시한 점은 강점입니다. 반면, 팀 내 개인 기여 구분과 실험 한계 서술이 부족해 '연구 성숙도' 측면에서 보강이 필요합니다.",
  keywordClustering: {
    personalityTendency: ["분석형", "자기주도형", "성장 지향"],
    coreCompetency: ["LLM/NLP 파이프라인", "Object Detection", "데이터 품질 관리", "백테스팅"],
    jobIndustry: ["AI/ML 엔지니어링", "데이터 사이언스", "자연어처리 연구"],
  },
  experienceInsights: {
    motivation:
      "실세계 문제를 공학적으로 분석하고 정량적으로 검증하는 과정에서 강한 동기를 느끼며, 새로운 기술(LLM 등)을 직접 적용해보는 것을 즐깁니다.",
    learningPoints:
      "LLM 추론 파이프라인 설계, Object Detection 앙상블 전략, 데이터 레이블링 품질 관리를 핵심 학습 포인트로 정리할 수 있습니다.",
  },
  synergyCombinations: [
    {
      combinationTitle: "LLM + NLP 연구 결합",
      items: ["LLM 주가 예측 프로젝트", "NLP 연구실 학부 인턴"],
      synergyReason:
        "감성 분석 구현 경험과 연구실 NLP 데이터 파이프라인 경험을 결합해 'NLP 엔지니어' 직무에 강한 근거가 됩니다.",
      expectedEffect: "NLP 실무 + 연구 양 측면에서 신뢰도 상승",
      applicableRoles: ["NLP 엔지니어", "ML 엔지니어"],
    },
    {
      combinationTitle: "딥러닝 교육 + 개인 프로젝트 흐름",
      items: ["네이버 부스트캠프 AI Tech 6기", "LLM 주가 예측 프로젝트"],
      synergyReason:
        "체계적 교육 과정에서 쌓은 기반 위에 개인 프로젝트로 자기주도 실험을 이어간 성장 서사를 만듭니다.",
      expectedEffect: "학습 능력 + 실행력의 일관된 증명",
      applicableRoles: ["AI 엔지니어", "ML 엔지니어"],
    },
  ],
  additionalRecommendations: {
    certifications: ["정보처리기사", "ADsP (데이터분석 준전문가)"],
    clubsAndSocieties: ["AUSG (AWS 유저 그룹)", "캐글 코리아"],
    projectsAndContests: ["Kaggle Competition 참여", "오픈소스 NLP 라이브러리 기여", "AI 해커톤 출전"],
  },
  resumeStarFormat: [
    {
      title: "AI 기반 하이브리드 매매 전략 설계 및 백테스팅",
      situation: "뉴스 정보를 객관적으로 정량화하기 어려운 개인 투자 환경",
      task: "LLM 감성 점수와 SMA 기술 지표를 결합한 자동화 매매 알고리즘 구현",
      action: "Gemma-2-2b-it 감성 분석 → SMA 신호 결합 → 리스크 관리 포함 시뮬레이션",
      result: "전략 수익률 vs 시장 수익률 비교 백테스팅 완성 및 시각화",
    },
    {
      title: "한국어 혐오 표현 탐지 IAA 0.78 달성",
      situation: "레이블러 간 불일치(IAA 0.61)로 데이터 품질이 낮았던 연구 상황",
      task: "레이블링 가이드라인 보완으로 데이터 품질 향상",
      action: "모호한 경계 사례에 대한 예시 기반 가이드라인 작성 및 배포",
      result: "IAA 0.61 → 0.78로 개선, 실험 재현성 확보",
    },
  ],
  actionPlan: {
    shortTerm: "각 경험의 팀 기여도를 구체화하고, 실험 조건·한계를 명시",
    midTerm: "Kaggle Competition 또는 AI 해커톤으로 외부 검증 이력 1건 추가",
    longTerm: "오픈소스 NLP/CV 기여로 커뮤니티 인지도 확보 및 기술 블로그 운영",
  },
  criticalDiagnosis: {
    oneLineVerdict:
      "AI/ML 기술 스택은 탄탄하지만, '왜 이 방법을 선택했는가'에 대한 의사결정 근거가 부족해 연구 성숙도가 낮게 보일 수 있어요.",
    weaknesses: [
      {
        id: "cw-1",
        category: "의사결정 근거",
        severity: "high",
        title: "기술 선택 이유가 서술되지 않음",
        diagnosis: "Gemma-2, YOLOv8, KLUE-BERT를 선택한 이유가 각 경험에 서술되어 있지 않습니다.",
        evidence: "기술 나열 위주의 서술, 비교 검토 과정 미기재",
        impact: "기술 인터뷰에서 '왜 이 모델을 썼나요?' 질문에 답하기 어려울 수 있음",
        priorityAction: "주요 기술 선택 이유를 1~2줄씩 추가",
      },
      {
        id: "cw-2",
        category: "팀 기여",
        severity: "medium",
        title: "팀 프로젝트에서 개인 기여 불분명",
        diagnosis: "부스트캠프 Wrap-up, 버스 앱 개발에서 팀 내 본인 역할이 명확히 구분되지 않습니다.",
        evidence: "팀 성과로 서술, 개인 담당 영역 미기재",
        impact: "기여도 면접에서 자신의 역할을 설명하기 어려울 수 있음",
        priorityAction: "각 프로젝트에서 본인이 단독으로 담당한 모듈·역할 명시",
      },
    ],
    missingExperienceTypes: ["외부 발표/공유 경험", "타 직군 협업 경험"],
    contentQualityIssues: [
      {
        item: "'부스트캠프 Wrap-up 프로젝트' 항목",
        issue: "mAP 수치는 있으나 팀 내 본인의 역할과 기여가 불분명",
        improvementHint: "앙상블 전략 설계 등 본인 담당 부분을 명확히 기재",
      },
    ],
    competitorGap:
      "비슷한 학번 AI/ML 전공자 대비 프로젝트 다양성은 상위권이지만, 각 기술 선택에 대한 근거 서술은 평균 수준입니다.",
  },
  validJobRecommendations: [
    {
      company: "네이버",
      role: "ML 엔지니어 (신입)",
      deadline: "2026-06-30",
      whyMatch: "LLM 파이프라인 경험과 부스트캠프 수료 이력이 직접 연결됩니다.",
      url: "https://example.com/jobs/naver-ml",
    },
    {
      company: "카카오브레인",
      role: "AI 리서처 (인턴)",
      deadline: "2026-07-15",
      whyMatch: "NLP 연구실 인턴 경험과 독립적 AI 프로젝트 수행 이력이 연구 환경과 잘 맞습니다.",
      url: "https://example.com/jobs/kakao-brain",
    },
  ],
  missingInfoWarning:
    "기술 선택 근거, 팀 내 개인 기여 범위 등 일부 정보가 빠져 있어 채워주시면 분석 정확도가 더 올라갑니다.",
};

// ─── Keyword Analysis ───────────────────────────────────────

export const mockKeywordSuggestions: KeywordSuggestion[] = [
  { id: "ks-1", label: "문제 해결", category: "skill", reason: "4개 경험에서 문제 해결 패턴이 발견됨", relatedExperienceCount: 4 },
  { id: "ks-2", label: "데이터 분석", category: "skill", reason: "SQL, Python, 연구 데이터 처리 경험이 있음", relatedExperienceCount: 3 },
  { id: "ks-3", label: "자기주도성", category: "work_style", reason: "개인 프로젝트와 연구 참여에서 주도적 행동 근거가 있음", relatedExperienceCount: 3 },
  { id: "ks-4", label: "팀워크", category: "work_style", reason: "팀 프로젝트 및 교육 과정 협업 이력", relatedExperienceCount: 3 },
  { id: "ks-5", label: "성장 지향", category: "value", reason: "시간순 역량 성장이 확인됨", relatedExperienceCount: 5 },
  { id: "ks-6", label: "AI/ML", category: "job_domain", reason: "LLM, 딥러닝, NLP 중심의 경험 다수", relatedExperienceCount: 4 },
];

export const mockKeywordList: AnalysisSnapshot[] = [
  {
    id: "kw-1",
    type: "keyword",
    title: "'문제 해결 · 자기주도성' 키워드 분석",
    status: "completed",
    createdAt: "2026-05-03T11:00:00Z",
    experienceCount: 4,
    summaryText: "자기주도성 부합도가 매우 높으며, 문제 해결은 사례 구체화가 필요합니다.",
    overallConfidence: "partial",
    isBookmarked: false,
    selectedKeywords: ["문제 해결", "자기주도성"],
  },
  {
    id: "kw-2",
    type: "keyword",
    title: "'AI · 딥러닝' 키워드 분석",
    status: "completed",
    createdAt: "2026-05-01T15:00:00Z",
    experienceCount: 3,
    summaryText: "AI/딥러닝 역량이 충분히 증명됩니다.",
    overallConfidence: "sufficient",
    isBookmarked: true,
    selectedKeywords: ["AI", "딥러닝"],
  },
  {
    id: "kw-3",
    type: "keyword",
    title: "'데이터 분석 · 연구' 키워드 분석",
    status: "completed",
    createdAt: "2026-04-28T10:00:00Z",
    experienceCount: 3,
    summaryText: "데이터 분석은 충분, 연구 역량은 부분적으로 증명됩니다.",
    overallConfidence: "partial",
    isBookmarked: false,
    selectedKeywords: ["데이터 분석", "연구"],
  },
];

export const mockKeywordResult: KeywordAnalysisResult = {
  id: "kw-1",
  status: "completed",
  analysisDate: "2026-05-03T11:00:00Z",
  keywords: ["문제 해결", "자기주도성"],
  targetScenario: "AI/ML 분야 신입 엔지니어 또는 데이터 사이언티스트 지원",
  keywordDefinitions: [
    {
      keyword: "문제 해결",
      definition: "문제의 원인을 분석하고, 적절한 방법론을 선택해 실행 가능한 해결책을 도출하는 능력",
      synonyms: ["트러블슈팅", "분석적 사고", "해결 중심 사고"],
      complianceCriteria: [
        "문제를 정의하고 원인을 파악한 경험이 있는가",
        "복수의 해결 방안을 비교 검토한 경험이 있는가",
        "해결 결과를 정량적으로 검증한 경험이 있는가",
        "기술적 제약을 극복한 구체적 사례가 있는가",
      ],
    },
    {
      keyword: "자기주도성",
      definition: "외부의 지시 없이 스스로 목표를 설정하고, 계획하고, 실행하며 완수하는 능력",
      synonyms: ["자기 동기부여", "주도성", "독립적 실행"],
      complianceCriteria: [
        "스스로 프로젝트를 시작하고 완수한 경험이 있는가",
        "목표를 스스로 설정하고 조정한 경험이 있는가",
        "피드백 없이 독립적으로 의사결정한 사례가 있는가",
        "중도 포기 없이 결과물을 완성한 경험이 있는가",
      ],
    },
  ],
  selectionCriteria: {
    summary:
      "선택된 키워드('문제 해결', '자기주도성')와 관련된 행동, 성과, 역할 기술이 포함된 경험을 우선 선별했습니다.",
    criteria: [
      "단순 참여보다 구체적 행동과 결과가 있는 경험에 높은 가중치 부여",
      "개인 프로젝트 및 독립 실험 경험에 가산점 부여",
      "정량적 성과가 명시된 경험 우선",
    ],
  },
  coverage: [
    { keyword: "문제 해결", relatedCount: 3, totalCount: 5, coveragePercent: 60 },
    { keyword: "자기주도성", relatedCount: 3, totalCount: 5, coveragePercent: 60 },
  ],
  matchedExperiences: [
    {
      keyword: "자기주도성",
      experiences: [
        {
          careerTitle: "LLM 활용 뉴스 감성 분석 기반 하이브리드 주가 예측",
          organization: "개인 프로젝트",
          period: "2026.02 - 2026.05",
          relevance: "기획부터 구현, 검증까지 전 과정을 독립적으로 수행한 개인 프로젝트로, 자기주도성 핵심 기준 다수를 충족",
          evidence: [
            {
              type: "행동",
              content: "주제 선정부터 데이터 수집, 모델 선택, 백테스팅 설계까지 전 과정 독립 수행",
              sourceQuote: "Gemma-2 LLM을 활용해 비정형 뉴스 데이터를 정량적 투자 지표로 변환",
            },
            {
              type: "성과",
              content: "전략 수익률 vs 시장 수익률 비교 백테스팅 완성",
              sourceQuote: "전략 수익률 대비 시장 수익률 비교 백테스팅 및 시각화",
            },
          ],
          matchedCriteria: [
            "스스로 프로젝트를 시작하고 완수한 경험이 있는가",
            "목표를 스스로 설정하고 조정한 경험이 있는가",
            "중도 포기 없이 결과물을 완성한 경험이 있는가",
          ],
          confidence: "high",
          confidenceReason: "독립 수행 및 완성 결과물이 명확히 서술됨",
        },
        {
          careerTitle: "이커머스 매출 데이터 분석 및 시각화",
          organization: "개인 프로젝트",
          period: "2025.12 - 2026.01",
          relevance: "스스로 분석 질문을 설정하고 Tableau 대시보드로 완성한 포트폴리오 프로젝트",
          evidence: [
            {
              type: "행동",
              content: "비즈니스 관점의 분석 질문을 스스로 설정하고 답을 도출",
              sourceQuote: "코호트 분석, 재구매율, 지역별 매출 등 비즈니스 관점 분석 질문 설정",
            },
          ],
          matchedCriteria: [
            "스스로 프로젝트를 시작하고 완수한 경험이 있는가",
            "목표를 스스로 설정하고 조정한 경험이 있는가",
          ],
          confidence: "high",
          confidenceReason: "독립 수행 및 결과물(Tableau 대시보드) 완성이 명확",
        },
      ],
    },
    {
      keyword: "문제 해결",
      experiences: [
        {
          careerTitle: "LLM 활용 뉴스 감성 분석 기반 하이브리드 주가 예측",
          organization: "개인 프로젝트",
          period: "2026.02 - 2026.05",
          relevance: "yfinance 라이브러리 오류 해결, AI 환각 방지 기법 적용 등 기술적 문제를 구체적으로 해결",
          evidence: [
            {
              type: "행동",
              content: "yfinance Multi-index 오류를 get_level_values(0) 평탄화 로직으로 해결",
              sourceQuote: "yfinance 라이브러리의 Multi-index 업데이트 오류를 get_level_values(0) 평탄화 로직으로 해결",
            },
          ],
          matchedCriteria: [
            "문제를 정의하고 원인을 파악한 경험이 있는가",
            "기술적 제약을 극복한 구체적 사례가 있는가",
          ],
          confidence: "high",
          confidenceReason: "문제-원인-해결 흐름이 구체적으로 서술됨",
        },
        {
          careerTitle: "NLP 연구실 학부 인턴",
          organization: "한양대학교 자연어처리 연구실",
          period: "2025.09 - 2026.02",
          relevance: "레이블 불일치 문제를 가이드라인 개선으로 해결한 데이터 품질 문제 해결 사례",
          evidence: [
            {
              type: "행동",
              content: "모호한 경계 사례에 대한 예시 기반 가이드라인 보완",
              sourceQuote: "IAA 0.61 → 0.78 개선",
            },
            {
              type: "성과",
              content: "IAA 0.61에서 0.78로 17% 향상",
              sourceQuote: "IAA 0.61 → 0.78 개선",
            },
          ],
          matchedCriteria: [
            "문제를 정의하고 원인을 파악한 경험이 있는가",
            "해결 결과를 정량적으로 검증한 경험이 있는가",
          ],
          confidence: "high",
          confidenceReason: "정량적 개선 수치(IAA)와 해결 방법이 명확히 기재됨",
        },
      ],
    },
  ],
  storylines: [
    {
      keyword: "자기주도성",
      storylineTitle: "부스트캠프 수료 → 연구 참여 → 개인 프로젝트로 이어진 자기주도 성장",
      structure: {
        start: "네이버 부스트캠프에서 체계적 교육과 팀 프로젝트를 통해 AI 기반을 쌓은 계기",
        development: "연구실 인턴으로 참여해 독립적 실험 설계와 데이터 품질 관리를 경험",
        evidence: "가이드라인 작성, IAA 측정 스크립트 독립 구현, 실험 파이프라인 구성",
        growth: "LLM 개인 프로젝트로 주제 선정부터 완성까지 전 과정을 독립 수행",
        destination: "자기주도적 AI 엔지니어로 성장하는 일관된 흐름",
      },
      usedExperiences: {
        core: ["LLM 주가 예측 프로젝트", "이커머스 데이터 분석"],
        supporting: ["네이버 부스트캠프 AI Tech 6기"],
      },
      keyQuotes: [
        "Gemma-2 LLM을 활용해 비정형 뉴스 데이터를 정량적 투자 지표로 변환",
        "비즈니스 관점의 분석 질문을 스스로 설정하고 답을 도출",
      ],
    },
  ],
  improvementGuide: {
    informationEnhancement: [
      "각 문제 해결 과정에서 '왜 이 방법을 선택했는가'에 대한 의사결정 근거 추가",
      "자기주도 프로젝트에서 중간에 방향을 수정한 경험이 있다면 서술",
    ],
    experienceExpansion: [
      "외부 경진대회(캐글 등)에서 문제 해결 과정을 공개적으로 기록",
      "팀 프로젝트에서 본인이 문제 해결을 주도한 사례 구체화",
    ],
    keywordSpecificRecommendations: [
      {
        keyword: "문제 해결",
        description: "기술 블로그에 트러블슈팅 경험을 정리하면 '문제 해결 능력'을 외부에서 검증할 수 있습니다.",
      },
      {
        keyword: "자기주도성",
        description: "개인 프로젝트를 GitHub에 정리하고 README에 동기·과정·결과를 명확히 기술하세요.",
      },
    ],
  },
};

// ─── Bookmarks ──────────────────────────────────────────────

export const mockBookmarks: BookmarkedSnapshot[] = [
  { ...mockIndividualAnalysisList[0], bookmarkedAt: "2026-05-08T15:00:00Z" },
  { ...mockIndividualAnalysisList[4], bookmarkedAt: "2026-05-02T12:00:00Z" },
  { ...mockComprehensiveList[0], bookmarkedAt: "2026-05-07T13:00:00Z" },
  { ...mockKeywordList[1], bookmarkedAt: "2026-05-01T16:00:00Z" },
];

// ─── History ────────────────────────────────────────────────

export const mockHistory: AnalysisSnapshot[] = [
  ...mockIndividualAnalysisList.filter((s) => s.status === "completed"),
  ...mockComprehensiveList.filter((s) => s.status === "completed"),
  ...mockKeywordList,
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

// ─── Selectable Experiences (for new analysis) ──────────────

export const mockSelectableExperiences = [
  { id: "exp-v2-1", title: "LLM 활용 뉴스 감성 분석 기반 하이브리드 주가 예측 프로젝트", type: "personal-project", importance: 5 as const, isComplete: true },
  { id: "exp-v2-2", title: "공공 데이터 포털 API 활용 버스 실시간 도착 정보 앱 개발", type: "team-project", importance: 4 as const, isComplete: true },
  { id: "exp-v2-3", title: "네이버 부스트캠프 AI Tech 6기 수료", type: "extracurricular", importance: 4 as const, isComplete: true },
  { id: "exp-v2-4", title: "학부 연구생 활동 — 자연어처리 연구실 (NLP Lab)", type: "career", importance: 3 as const, isComplete: true },
  { id: "exp-v2-5", title: "SQL 및 Tableau 활용 이커머스 매출 데이터 분석", type: "personal-project", importance: 3 as const, isComplete: true },
];
