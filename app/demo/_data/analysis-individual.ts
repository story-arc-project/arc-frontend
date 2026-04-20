import type { IndividualAnalysisResult } from "@/types/analysis";

export const demoIndividualResult: IndividualAnalysisResult = {
  id: "ind-1",
  experienceId: "exp-1",
  experienceTitle: "오늘의 집 마케팅 인턴",
  experienceType: "인턴 및 업무 경력",
  analyzedAt: "2026-04-17T15:22:00Z",
  isBookmarked: true,
  overallConfidence: "sufficient",
  summary:
    "3개월간 인테리어 플랫폼의 퍼포먼스 마케팅 팀에서 GA4 기반 캠페인 운영·리포팅을 주도한 경험입니다. 'A/B 실험 → 근거 있는 피드백 → 협업 품질 향상'이라는 작업 루프가 일관되게 드러납니다.",
  incidents: [
    {
      id: "inc-1",
      situation: "메인 캠페인 CTR이 정체되어 신규 고객 유입 증가 목표 달성이 어려운 상황",
      action: "저효율 크리에이티브를 GA4·Meta 데이터로 식별하고, 2주 단위 A/B 소재 실험 구조를 세팅해 디자이너에게 근거 기반 피드백을 전달",
      result: "메인 캠페인 CTR 2.1% → 3.4% (+1.3%p), 신규 고객 CAC 18% 절감",
      evidence: {
        quote: "A/B 소재 실험을 통해 메인 캠페인 CTR을 2.1% → 3.4%로 개선했고, CAC를 평균 18% 절감",
        sourceField: "핵심 성과",
        experienceTitle: "오늘의 집 마케팅 인턴",
      },
    },
    {
      id: "inc-2",
      situation: "팀의 주간 캠페인 리포팅 포맷이 분석가마다 달라 해석이 엇갈리던 상황",
      action: "UTM 체계를 정리하고 Looker Studio 기반 주간 리포트 템플릿을 만들어 후속 인턴에게 인수인계",
      result: "팀 표준 리포트 포맷으로 채택됨. 주간 의사결정에 걸리는 시간이 짧아짐.",
      evidence: {
        quote: "주차별 마케팅 위클리 리포트 템플릿을 구축해 팀에 인수인계",
        sourceField: "핵심 성과",
        experienceTitle: "오늘의 집 마케팅 인턴",
      },
    },
  ],
  roleInterpretations: [
    {
      incidentId: "inc-1",
      role: {
        responsibility: "주요 캠페인 4건의 성과 진단 및 최적화",
        scope: "퍼포먼스 마케팅팀 내 실험/최적화 태스크",
        decisionAuthority: "소재 재집행/폐기, A/B 설계안 제안",
      },
      action: { type: "문제 해결", description: "데이터로 저효율 소재를 식별하고 주기적 실험 루틴을 도입" },
      performance: { metric: "CTR +1.3%p, CAC -18%", output: "A/B 실험 2주 루틴", change: "신규 고객 유입 증가" },
    },
    {
      incidentId: "inc-2",
      role: {
        responsibility: "팀 내 리포팅 포맷 표준화",
        scope: "팀 전체 주간 리포트",
        decisionAuthority: "UTM 네이밍 규칙 및 대시보드 구조 설계",
      },
      action: { type: "구조 설계", description: "UTM 체계 + Looker Studio 템플릿 + 인수인계 문서 작성" },
      performance: { metric: "표준 포맷 채택", output: "주간 리포트 템플릿", change: "팀 의사결정 리드타임 단축" },
    },
  ],
  keywords: [
    {
      id: "k-1",
      label: "퍼포먼스 마케팅",
      category: "skill",
      confidence: "sufficient",
      evidences: [
        { quote: "메타·구글 광고 캠페인 4건을 운영", experienceTitle: "오늘의 집 마케팅 인턴" },
      ],
    },
    {
      id: "k-2",
      label: "데이터 분석",
      category: "skill",
      confidence: "sufficient",
      evidences: [
        { quote: "GA4 데이터로 세그먼트별 CAC를 주간으로 리포트", experienceTitle: "오늘의 집 마케팅 인턴" },
      ],
    },
    {
      id: "k-3",
      label: "숫자 기반 커뮤니케이션",
      category: "work_style",
      confidence: "sufficient",
      evidences: [
        { quote: "디자이너에게 근거 있는 피드백을 전달", experienceTitle: "오늘의 집 마케팅 인턴" },
      ],
    },
    {
      id: "k-4",
      label: "빠른 가설 검증",
      category: "value",
      confidence: "partial",
      evidences: [
        { quote: "가설 검증 주기를 짧게 가져가는 것이 장기 효율을 만든다", experienceTitle: "오늘의 집 마케팅 인턴" },
      ],
    },
  ],
  starSummaries: [
    {
      incidentId: "inc-1",
      situation: "메인 캠페인 CTR이 정체되고 신규 고객 유입이 둔화",
      task: "A/B 소재 실험으로 CTR과 CAC를 개선",
      action: "GA4·Meta 데이터로 저효율 소재 식별 → 2주 실험 루틴 → 디자이너 피드백",
      result: "CTR +1.3%p, CAC -18%",
      missingFields: [],
    },
    {
      incidentId: "inc-2",
      situation: "팀 주간 리포트 포맷이 분석가마다 달라 해석이 흔들림",
      task: "표준 리포팅 구조 정립",
      action: "UTM 체계 정리 + Looker Studio 템플릿 구축 + 인수인계",
      result: "팀 표준 포맷으로 채택, 주간 의사결정 리드타임 단축",
      missingFields: [],
    },
  ],
  recommendations: [
    {
      id: "rec-1",
      activity: "A/B 실험 설계 케이스 스터디 블로그 발행",
      reason: "정량 근거 + 협업 프로세스가 함께 있어 콘텐츠 설득력이 높습니다.",
      evidence: { quote: "CTR 2.1% → 3.4%", experienceTitle: "오늘의 집 마케팅 인턴" },
      expectedEffect: "인턴 이후의 학습을 공개적으로 증명. 브랜드 PR 채용 전형에서 근거로 활용 가능.",
      type: "expand",
    },
    {
      id: "rec-2",
      activity: "SQL 실전 프로젝트 1건 추가",
      reason: "GA4는 강하지만 원천 데이터를 직접 다루는 근거가 아직 부족합니다.",
      evidence: { quote: "SQL 기초", experienceTitle: "오늘의 집 마케팅 인턴" },
      expectedEffect: "데이터 기반 마케터 포지션의 스크리닝 통과율 상승.",
      type: "supplement",
    },
    {
      id: "rec-3",
      activity: "팀 내부 의견 충돌 사례 구체화",
      reason: "수치 커뮤니케이션은 있으나 감정 갈등을 조율한 증거는 부족합니다.",
      evidence: { quote: "디자이너와 숫자로 이야기하는 습관", experienceTitle: "오늘의 집 마케팅 인턴" },
      expectedEffect: "협업 역량 증거 강화.",
      type: "supplement",
    },
  ],
  improvementGuides: [
    {
      reason: "협업 과정의 갈등·조율 사례가 부족합니다.",
      suggestion: "의견이 갈렸을 때 어떻게 근거를 제시해 설득했는지 1~2건을 구체화해보세요.",
      targetField: "내 역할/기여도",
    },
    {
      reason: "SQL 활용 깊이가 '기초' 수준으로만 표현돼 있습니다.",
      suggestion: "실제 쿼리 예시나 집계 자동화 사례를 추가해 깊이를 증명해보세요.",
    },
  ],
  reusableExpressions: [
    {
      type: "30s_summary",
      label: "30초 요약",
      text: "오늘의 집 퍼포먼스 마케팅 인턴으로 3개월간 GA4·Meta 캠페인 4건을 운영하며 CTR을 +1.3%p, CAC를 -18% 개선했습니다. 주간 리포트 템플릿을 표준화해 팀 의사결정 속도를 높였습니다.",
    },
    {
      type: "performance",
      label: "성과 중심",
      text: "메인 캠페인 CTR 2.1%→3.4% 개선, 신규 고객 CAC 18% 절감. 팀 주간 리포트 표준 포맷 정립.",
    },
    {
      type: "problem_solving",
      label: "문제 해결",
      text: "저효율 크리에이티브로 CTR이 정체된 상황에서, GA4 데이터 기반으로 2주 A/B 실험 루틴을 설계해 CTR +1.3%p를 만들었습니다.",
    },
    {
      type: "collaboration",
      label: "협업",
      text: "디자이너·PM과 숫자 기반으로 피드백을 주고받는 프로세스를 정착시켜, 크리에이티브 재작업 횟수를 줄였습니다.",
    },
    {
      type: "learning",
      label: "학습/성장",
      text: "가설을 짧게 돌리는 실험 리듬과, 분석 결과를 협업 파트너의 언어로 번역하는 커뮤니케이션 방법을 몸으로 익혔습니다.",
    },
  ],
  relatedExperiences: [
    {
      experienceId: "exp-4",
      title: "네이버 부스트캠프 마케팅 데이터 분석 트랙 수료",
      reason: "부스트캠프에서 쌓은 SQL·GA4 기본기가 인턴십의 실제 분석으로 확장됐습니다.",
      connectionType: "temporal_growth",
    },
    {
      experienceId: "exp-3",
      title: "유한킴벌리 대학생 마케팅 공모전 2위",
      reason: "브랜드 전략과 퍼포먼스 마케팅을 양 축으로 묶어 포지셔닝을 만들 수 있습니다.",
      connectionType: "role_expansion",
    },
    {
      experienceId: "exp-6",
      title: "Google Analytics 개인 자격증 (GAIQ)",
      reason: "GA4 활용 실전 경험의 공식 증빙으로 연결됩니다.",
      connectionType: "impact_expansion",
    },
  ],
};

// ─── Schema Extension (데모 전용) ──────────────────────────────
// 유저가 제공한 원본 JSON 스키마에서 현재 UI에 아직 매핑되지 않은 필드를
// 데모 페이지 하단에서 추가로 보여주기 위한 데이터.

export interface IndividualExtra {
  deepAnalysis: {
    careerValue: string;
    strengths: string[];
    limitations: string[];
    applicableRoles: string[];
    marketValue: string;
  };
  itemDiagnosis: {
    oneLineVerdict: string;
    weaknesses: {
      id: number;
      category:
        | "서술_완성도"
        | "차별성_부족"
        | "직무_연결_약함"
        | "성과_불명확"
        | "기간_문제"
        | "단독_활용_한계";
      severity: "critical" | "major" | "minor";
      title: string;
      diagnosis: string;
      evidence: string;
      impact: string;
      priorityAction: string;
      improvementExample?: string;
    }[];
    missingElements: string[];
    rewriteSuggestion: string;
  };
  synergyRecommendations: {
    priority: number;
    category: "자격증" | "교육강의" | "프로젝트" | "대외활동" | "경험";
    name: string;
    reason: string;
    expectedEffect: string;
    estimatedDuration?: string;
  }[];
  actionPlan: {
    단기: string;
    중기: string;
    장기: string;
  };
}

export const demoIndividualExtra: IndividualExtra = {
  deepAnalysis: {
    careerValue:
      "짧은 기간임에도 '데이터로 캠페인을 바꾼 경험'과 '팀 내부 구조를 바꾼 경험' 2개가 동시에 확보돼, 퍼포먼스 마케터 주니어 포지션에서 즉시 어필 가능합니다.",
    strengths: [
      "GA4·Meta를 실무에서 직접 다룬 경험 (도구 리터러시 충분)",
      "숫자로 협업 파트너를 설득하는 커뮤니케이션 습관",
      "문제 → 실험 설계 → 근거 피드백의 루프가 명확",
    ],
    limitations: [
      "3개월이라는 기간이 깊이 증명에 다소 부족",
      "SQL 깊이가 '기초' 수준으로 표현됨",
      "감정적 갈등을 조율한 서술이 부재",
    ],
    applicableRoles: ["퍼포먼스 마케터", "그로스 마케터", "데이터 드리븐 브랜드 매니저"],
    marketValue:
      "2026년 기준 GA4 숙련 주니어의 수요는 꾸준하나, SQL·BigQuery까지 다루는 인재의 희소성이 빠르게 높아지고 있습니다. 본 경험은 상위 30% 수준의 실무 근거를 확보하고 있습니다.",
  },
  itemDiagnosis: {
    oneLineVerdict:
      "'퍼포먼스 실무를 숫자로 돌려본 인턴'으로서 합격점. 단, 인턴 단일 경험만으로 정규직 포지션의 시그널을 모두 증명하진 못합니다.",
    weaknesses: [
      {
        id: 1,
        category: "성과_불명확",
        severity: "minor",
        title: "CAC 절감 18%의 기준값이 불명확",
        diagnosis: "어떤 기간·어떤 세그먼트 대비 18% 감소인지 명시되지 않았습니다.",
        evidence: "CAC를 평균 18% 절감",
        impact: "면접에서 추가 질문으로 이어질 때 불리하게 작용할 수 있습니다.",
        priorityAction: "비교 기간과 비교 대상 세그먼트를 한 줄로 명시.",
        improvementExample: "직전 4주 평균 대비 신규 고객 세그먼트 CAC 18% 절감",
      },
      {
        id: 2,
        category: "단독_활용_한계",
        severity: "major",
        title: "인턴 단일 경험만으로 '데이터 기반 마케터' 타이틀이 성립하기 어려움",
        diagnosis: "공모전·부트캠프·블로그 등 주변 경험과 함께 묶여야 설득력이 완성됩니다.",
        evidence: "3개월간 오늘의 집 퍼포먼스 마케팅 인턴",
        impact: "단일 이력만으로는 시니어 매니저의 확신을 얻기 어렵습니다.",
        priorityAction: "종합 분석·이력서에서 exp-1을 exp-3·exp-4·exp-6과 묶어 스토리로 구성.",
      },
    ],
    missingElements: [
      "갈등 조율 사례",
      "SQL 실전 쿼리 예시",
      "마케팅 외 타 직군(디자이너 제외)과의 협업 근거",
    ],
    rewriteSuggestion:
      "이력서에서는 'GA4 A/B 실험으로 CTR +1.3%p, CAC -18% (직전 4주 대비)' 같은 비교 기준을 반드시 명시하세요. 협업 사례는 '어떻게 근거를 정리해 디자이너를 설득했는지' 1줄을 추가하면 즉시 좋아집니다.",
  },
  synergyRecommendations: [
    {
      priority: 1,
      category: "자격증",
      name: "Google BigQuery 기반 데이터 분석 자격 (GCP 디지털 리더 + BQ 실전 과정)",
      reason: "GA4 경험을 원천 데이터 수준까지 확장해 서류 키워드 커버리지를 넓힙니다.",
      expectedEffect: "데이터 마케터 포지션 서류 스크리닝 통과율 상승",
      estimatedDuration: "4~6주",
    },
    {
      priority: 2,
      category: "프로젝트",
      name: "코호트 리텐션 분석 사이드 프로젝트 (공개 GitHub)",
      reason: "팀 외부에서도 분석 역량을 증명할 수 있는 퍼블릭 아티팩트가 필요합니다.",
      expectedEffect: "채용 담당자가 직접 확인 가능한 '증거 링크' 확보",
      estimatedDuration: "3주",
    },
    {
      priority: 3,
      category: "대외활동",
      name: "마케팅 데이터 커뮤니티 세미나 발표 1회",
      reason: "숫자 커뮤니케이션 강점을 퍼블릭하게 증명하는 최단 루트입니다.",
      expectedEffect: "'설득하는 마케터' 포지션 차별화",
    },
  ],
  actionPlan: {
    단기: "인턴 케이스 스터디 블로그 2편 발행 + SQL 프로젝트 깃허브 공개 (3~4주 내 완료)",
    중기: "BigQuery 실전 과정 수료 + 마케팅 커뮤니티 세미나 발표 (2~3개월)",
    장기: "브랜드 매니저와 그로스 마케터 이력을 한 줄에 묶을 수 있는 '풀시즌 마케팅 운영' 경험 확보 (6~12개월)",
  },
};

export const demoIndividualResultsById: Record<string, IndividualAnalysisResult> = {
  [demoIndividualResult.id]: demoIndividualResult,
};

export const demoIndividualExtraById: Record<string, IndividualExtra> = {
  [demoIndividualResult.id]: demoIndividualExtra,
};
