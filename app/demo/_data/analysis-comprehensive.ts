import type { ComprehensiveAnalysisResult } from "@/types/analysis";

export const demoComprehensiveResult: ComprehensiveAnalysisResult = {
  id: "comp-1",
  title: "디지털 마케팅 커리어 종합 분석",
  analyzedAt: "2026-04-16T09:40:00Z",
  isBookmarked: true,
  overallConfidence: "sufficient",
  selectedExperienceIds: ["exp-1", "exp-2", "exp-3", "exp-4"],
  experienceSummaries: [
    {
      experienceId: "exp-1",
      title: "오늘의 집 마케팅 인턴",
      summary: "GA4 기반 퍼포먼스 마케팅 실무. CTR·CAC 개선 성과.",
      highlight: "CTR +1.3%p · CAC -18%",
      role: "primary",
      importance: 5,
    },
    {
      experienceId: "exp-3",
      title: "유한킴벌리 공모전 2위",
      summary: "Z세대 대상 리브랜딩 전략으로 298팀 중 2위 수상.",
      highlight: "전국 2위 · 서베이+FGI 근거",
      role: "primary",
      importance: 4,
    },
    {
      experienceId: "exp-4",
      title: "부스트캠프 마케팅 데이터 트랙 수료",
      summary: "SQL·GA4·Looker Studio 실전 과제. 상위 12%.",
      highlight: "SQL · GA4 · 코호트 분석",
      role: "supporting",
      importance: 3,
    },
    {
      experienceId: "exp-2",
      title: "창업동아리 '브랜드랩' 운영진",
      summary: "18명 구조 설계형 리더십. 완주율 55→83%.",
      highlight: "완주율 +28%p",
      role: "supporting",
      importance: 4,
    },
  ],
  keywords: [
    {
      id: "ck-1",
      label: "퍼포먼스 마케팅",
      category: "skill",
      confidence: "sufficient",
      evidences: [
        { quote: "메타·구글 광고 캠페인 4건을 운영", experienceTitle: "오늘의 집 마케팅 인턴" },
        { quote: "GA4 데이터로 세그먼트별 CAC를 주간으로 리포트", experienceTitle: "오늘의 집 마케팅 인턴" },
      ],
    },
    {
      id: "ck-2",
      label: "브랜드 전략",
      category: "skill",
      confidence: "partial",
      evidences: [
        { quote: "'매일이 다르니까' 캠페인 컨셉을 제안", experienceTitle: "유한킴벌리 공모전" },
      ],
    },
    {
      id: "ck-3",
      label: "데이터 분석",
      category: "skill",
      confidence: "sufficient",
      evidences: [
        { quote: "코호트 리텐션 분석 대시보드 구축", experienceTitle: "부스트캠프" },
        { quote: "A/B 소재 실험", experienceTitle: "오늘의 집 마케팅 인턴" },
      ],
    },
    {
      id: "ck-4",
      label: "구조 설계 리더십",
      category: "work_style",
      confidence: "sufficient",
      evidences: [
        { quote: "학기 전 OKR을 운영진과 함께 정의", experienceTitle: "브랜드랩" },
      ],
    },
    {
      id: "ck-5",
      label: "데이터 기반 마케팅",
      category: "job_domain",
      confidence: "sufficient",
      evidences: [
        { quote: "SQL·GA4 실전 과제", experienceTitle: "부스트캠프" },
      ],
    },
  ],
  connections: [
    {
      fromExperienceId: "exp-4",
      fromTitle: "부스트캠프",
      toExperienceId: "exp-1",
      toTitle: "오늘의 집 마케팅 인턴",
      connectionType: "temporal_growth",
      strength: "strong",
      evidence: {
        quote: "부스트캠프에서 배운 SQL·GA4를 인턴에서 실무에 즉시 적용",
        experienceTitle: "부스트캠프 → 오늘의 집",
      },
    },
    {
      fromExperienceId: "exp-3",
      fromTitle: "유한킴벌리 공모전",
      toExperienceId: "exp-1",
      toTitle: "오늘의 집 마케팅 인턴",
      connectionType: "role_expansion",
      strength: "moderate",
      evidence: {
        quote: "브랜드 전략 기획에서 퍼포먼스 운영으로 역할이 확장됨",
        experienceTitle: "공모전 → 인턴",
      },
    },
    {
      fromExperienceId: "exp-2",
      fromTitle: "브랜드랩 운영",
      toExperienceId: "exp-1",
      toTitle: "오늘의 집 마케팅 인턴",
      connectionType: "impact_expansion",
      strength: "weak",
      evidence: {
        quote: "동아리 운영의 '리듬 설계' 경험이 팀 리포트 표준화 행동으로 이어짐",
        experienceTitle: "브랜드랩 → 인턴",
      },
      improvementGuide: {
        reason: "구조 설계 리더십과 팀 리포트 표준화의 연결이 추정 수준입니다.",
        suggestion: "인턴에서 '왜 리포트 표준이 필요하다고 판단했는지' 한 줄을 추가해 연결을 명시.",
      },
    },
  ],
  storylines: [
    {
      id: "sl-1",
      start: "학생회·동아리 운영에서 '공동 목표를 위한 구조'를 설계하는 즐거움을 발견",
      development:
        "공모전(브랜드 전략 기획)과 부스트캠프(데이터 분석)로 기획 축과 분석 축을 각각 단련",
      evidence: "유한킴벌리 공모전 2위 · 부스트캠프 상위 12%",
      growth:
        "오늘의 집 인턴십에서 두 축을 한 번에 써야 하는 퍼포먼스 실무를 경험하며, 숫자 기반 협업 습관을 정착",
      arrival:
        "데이터 기반으로 의사결정 속도를 높이고, 팀 구조를 개선해 성과를 만드는 디지털 마케터",
      coreExperienceIds: ["exp-1", "exp-3", "exp-4"],
      supportingExperienceIds: ["exp-2"],
    },
  ],
  scenarios: [
    {
      id: "sc-1",
      title: "D2C 스타트업 그로스 마케터",
      rationale:
        "데이터 도구 숙련도·실험 루틴·협업 커뮤니케이션 3요소가 모두 증거와 함께 확보돼 있음.",
      recommendedExperienceIds: ["exp-1", "exp-4", "exp-6"],
      emphasisPoints: ["CTR/CAC 수치", "A/B 실험 루틴", "GA4·SQL 기초"],
      speakingOrder: ["오늘의 집 인턴 → 부스트캠프 → 블로그 연재 순으로 타임라인 구성"],
    },
    {
      id: "sc-2",
      title: "브랜드 커머스 브랜드 매니저 주니어",
      rationale:
        "브랜드 전략 기획 경험(공모전)과 퍼포먼스 운영(인턴)이 함께 있어 매니저 후보군으로 경쟁력 있음.",
      recommendedExperienceIds: ["exp-3", "exp-1", "exp-5"],
      emphasisPoints: ["공모전 전국 2위", "브랜드 블로그 SEO 성과", "IMC 플랜"],
      speakingOrder: ["공모전 컨셉 제안 → 블로그 SEO 실험 → 인턴 퍼포먼스 운영"],
      fitComment:
        "대형 브랜드사 JD에서 'BM 주니어'의 정량 성과 요구가 높아지는 추세라 퍼포먼스 근거가 반드시 결합돼야 합니다.",
    },
  ],
  commonRecommendations: [
    {
      id: "crec-1",
      activity: "마케팅 데이터 대시보드 포트폴리오 공개",
      reason: "GA4·Looker 실전 산출물을 퍼블릭하게 노출하면 서류 통과율이 올라갑니다.",
      evidence: { quote: "Looker Studio 기반 주간 리포트 템플릿", experienceTitle: "오늘의 집 마케팅 인턴" },
      expectedEffect: "정량 증명 강화",
      type: "expand",
    },
    {
      id: "crec-2",
      activity: "Kaggle/공공데이터 기반 SQL 프로젝트 1건",
      reason: "인턴/부트캠프에 의존하지 않는 '혼자 만든 근거'가 필요합니다.",
      evidence: { quote: "SQL 기초", experienceTitle: "오늘의 집 마케팅 인턴" },
      expectedEffect: "SQL 깊이 증명",
      type: "supplement",
    },
    {
      id: "crec-3",
      activity: "브랜드 리브랜딩 공개 사례 연구 2편",
      reason: "브랜드 전략 경험이 공모전 단일 사례로만 남아 있는 점을 보강.",
      evidence: { quote: "유한킴벌리 공모전 2위", experienceTitle: "유한킴벌리 공모전" },
      expectedEffect: "브랜드 전략 포지션 설득력 상승",
      type: "supplement",
    },
  ],
  scenarioRecommendations: [
    {
      id: "srec-1",
      activity: "그로스 실험 카드 포맷 오픈소스화",
      reason: "그로스 팀 면접에서 '실험 루틴을 어떻게 운영했는지'가 핵심 질문입니다.",
      evidence: { quote: "2주 단위 A/B 소재 실험", experienceTitle: "오늘의 집 마케팅 인턴" },
      expectedEffect: "그로스 마케터 JD 매칭도 상승",
      type: "expand",
      scenarioId: "sc-1",
    },
    {
      id: "srec-2",
      activity: "브랜드 쇼퍼 인사이트 리서치 1건 추가",
      reason: "BM 포지션은 소비자 조사 최신성이 자주 확인됩니다.",
      evidence: { quote: "FGI 진행", experienceTitle: "유한킴벌리 공모전" },
      expectedEffect: "BM 주니어 설득력 상승",
      type: "supplement",
      scenarioId: "sc-2",
    },
  ],
  confidenceGuide: {
    overallConfidence: "sufficient",
    improvementGuides: [
      {
        reason: "브랜드 전략 증거가 공모전 단일 사례에 집중돼 있습니다.",
        suggestion: "블로그·사이드 프로젝트에서 브랜드 관점 케이스 1~2편을 추가로 공개하세요.",
      },
      {
        reason: "정규직 전환 경험이 없어 장기 성과 증거가 제한적입니다.",
        suggestion: "상반기 마케팅 인턴/풀타임 계약직을 추가로 경험하는 것이 가장 효과적입니다.",
        targetField: "핵심 성과",
      },
    ],
  },
};

// ─── Schema Extension (데모 전용) ──────────────────────────────

export interface ComprehensiveExtra {
  userSchool: string;
  userDepartment: string;
  briefSummary: string;
  detailedSummary: string;
  keywordClustering: {
    personalityTendency: string[];
    coreCompetency: string[];
    jobIndustry: string[];
  };
  synergyCombinations: {
    combinationTitle: string;
    items: string[];
    synergyReason: string;
    expectedEffect: string;
    applicableRoles: string[];
  }[];
  criticalDiagnosis: {
    oneLineVerdict: string;
    weaknesses: {
      id: number;
      category:
        | "활동_수량"
        | "활동_깊이"
        | "직무_연관성"
        | "스킬_공백"
        | "기간_연속성"
        | "서류_품질"
        | "경쟁력_격차";
      severity: "critical" | "major" | "minor";
      title: string;
      diagnosis: string;
      evidence: string;
      impact: string;
      priorityAction: string;
    }[];
    missingExperienceTypes: string[];
    competitorGap: string;
  };
  resumeStarFormat: {
    title: string;
    S: string;
    T: string;
    A: string;
    R: string;
  }[];
  validJobRecommendations: {
    company: string;
    role: string;
    deadline: string;
    whyMatch: string;
    url?: string | null;
  }[];
  actionPlan: {
    단기: string;
    중기: string;
    장기: string;
  };
}

export const demoComprehensiveExtra: ComprehensiveExtra = {
  userSchool: "성균관대학교",
  userDepartment: "경영학부",
  briefSummary:
    "데이터·브랜드·운영의 세 축이 3년에 걸쳐 자연스럽게 쌓여 온 '데이터 기반 마케터' 후보입니다.",
  detailedSummary:
    "퍼포먼스 실무(인턴)·브랜드 전략(공모전)·분석 훈련(부스트캠프)의 3축이 서로 독립된 이벤트가 아니라 시간순으로 서로를 강화합니다. 운영 리더십(브랜드랩 동아리)이 내러티브의 하단을 받치는 구조로, '왜 데이터·왜 브랜드·왜 팀'의 세 가지 Why가 모두 근거를 가진 상태입니다.",
  keywordClustering: {
    personalityTendency: ["구조 설계형", "증거 기반 설득형", "지속 실행형"],
    coreCompetency: ["퍼포먼스 마케팅", "데이터 분석", "브랜드 전략", "팀 퍼실리테이션"],
    jobIndustry: ["D2C 커머스", "콘텐츠 플랫폼", "브랜드 마케팅 에이전시"],
  },
  synergyCombinations: [
    {
      combinationTitle: "데이터 ⨯ 브랜드 더블트랙",
      items: ["오늘의 집 인턴", "유한킴벌리 공모전", "GAIQ"],
      synergyReason:
        "브랜드 전략 근거 + 퍼포먼스 실행 근거 + 공식 자격까지 묶여 '브랜드를 숫자로 운영할 수 있는 마케터'로 자리잡습니다.",
      expectedEffect: "D2C·대형 브랜드사 주니어 전형에서 경쟁력 상승",
      applicableRoles: ["브랜드 매니저 주니어", "그로스 마케터"],
    },
    {
      combinationTitle: "콘텐츠 ⨯ 리더십 더블트랙",
      items: ["브랜드 블로그", "브랜드랩 운영진", "소상공인 SNS 봉사"],
      synergyReason:
        "혼자 쓰는 힘 + 팀을 끌고 가는 힘 + 현장에서 작동시키는 힘이 모두 증명됩니다.",
      expectedEffect: "에이전시 콘텐츠 스트래터지스트 포지션에 유리",
      applicableRoles: ["콘텐츠 스트래터지스트", "브랜드 에디터"],
    },
  ],
  criticalDiagnosis: {
    oneLineVerdict:
      "'데이터 기반 마케터' 방향성으로는 평균 이상의 근거를 이미 가지고 있지만, 정규직 트랙 경쟁력은 한 단계 더 필요합니다.",
    weaknesses: [
      {
        id: 1,
        category: "기간_연속성",
        severity: "major",
        title: "3개월 단일 인턴 외 장기 실무 트랙 부재",
        diagnosis:
          "현업 JD에서 '6개월 이상' 경험이 자주 요구되며, 단일 인턴으로는 장기 책임 수행 근거가 약합니다.",
        evidence: "2025-09-01 ~ 2025-11-30",
        impact: "대형사 정규직 공고 서류 스크리닝에서 밀릴 수 있습니다.",
        priorityAction: "상반기 중 추가 인턴/계약직 1회를 확보.",
      },
      {
        id: 2,
        category: "스킬_공백",
        severity: "major",
        title: "SQL/BigQuery 실전 증거 부족",
        diagnosis: "'기초'로만 서술돼 있어 숙련도를 판단하기 어렵습니다.",
        evidence: "SQL 기초",
        impact: "데이터 마케터 JD의 필수 요건 미충족으로 분류될 수 있습니다.",
        priorityAction: "공공 데이터 or Kaggle 기반 SQL 프로젝트 깃허브 공개.",
      },
      {
        id: 3,
        category: "경쟁력_격차",
        severity: "minor",
        title: "글로벌 캠페인/영어 마케팅 케이스 부재",
        diagnosis: "TOEIC 920은 있지만 실전 사용 증거로는 이어지지 않습니다.",
        evidence: "교환학생 준비 & TOEIC 920",
        impact: "외국계·글로벌 브랜드 공고에서 상대적 열위.",
        priorityAction: "교환학생 기간 중 영어 마케팅 케이스 1편을 블로그로 발행.",
      },
    ],
    missingExperienceTypes: ["장기 실무 경험(6개월+)", "글로벌 캠페인 노출", "B2B 마케팅 경험"],
    competitorGap:
      "같은 시기에 지원할 경쟁군은 동일 규모의 인턴 경험에 더해 SQL/BigQuery 실전 프로젝트 또는 사이드 브랜드 운영을 이미 가진 경우가 많습니다. '개인이 만든 근거'를 1개 더 확보하는 것이 최우선입니다.",
  },
  resumeStarFormat: [
    {
      title: "데이터 기반으로 메인 캠페인 CTR·CAC 개선",
      S: "신규 고객 유입이 둔화되어 CTR이 2.1%에서 정체된 상황",
      T: "2주 단위 A/B 실험 구조를 도입해 CTR/CAC를 개선",
      A: "GA4/Meta 데이터로 저효율 소재를 식별하고 디자이너에게 근거 기반 피드백 전달",
      R: "CTR 2.1→3.4% (+1.3%p), 신규 고객 CAC 직전 4주 대비 18% 절감",
    },
    {
      title: "팀 주간 리포트 표준화로 의사결정 리드타임 단축",
      S: "분석가마다 리포트 포맷이 달라 의사결정이 지연",
      T: "Looker Studio 기반 주간 리포트 템플릿 설계",
      A: "UTM 네이밍 규칙 + 공통 지표 세트 + 인수인계 문서 작성",
      R: "팀 표준 포맷으로 채택, 주간 회의 시간 30% 단축",
    },
    {
      title: "Z세대 타겟 공모전 2위 수상",
      S: "가격 경쟁이 심화된 여성 용품 카테고리에서 브랜드 차별화 필요",
      T: "Z세대 인사이트 기반 리브랜딩 전략 도출",
      A: "서베이(N=412) + FGI(n=8) 설계·집행 → '매일이 다르니까' 컨셉 제안",
      R: "전국 298팀 중 2위 수상 (특별상, 상금 300만원)",
    },
  ],
  validJobRecommendations: [
    {
      company: "마켓컬리",
      role: "그로스 마케터 어소시에이트",
      deadline: "2026-05-12",
      whyMatch: "퍼포먼스 마케팅 실무·GA4 숙련도·협업 커뮤니케이션이 JD와 강하게 매칭됩니다.",
      url: null,
    },
    {
      company: "무신사",
      role: "브랜드 마케팅 어시스턴트",
      deadline: "상시채용",
      whyMatch: "공모전의 브랜드 전략 기획과 블로그의 콘텐츠 실전이 BM 포지션의 기초를 충족합니다.",
      url: null,
    },
    {
      company: "쿠팡플레이",
      role: "프로덕트 마케팅 인턴",
      deadline: "2026-05-31",
      whyMatch: "SQL 기초 + GA4 + 실험 루틴이 PMM JD의 '데이터 리터러시' 요건과 부합.",
      url: null,
    },
  ],
  actionPlan: {
    단기: "SQL 프로젝트 1건 공개 + 마케팅 케이스 블로그 3편 연재 (4주 내)",
    중기: "D2C 스타트업 6개월 이상 인턴/계약직 확보 + BM 주니어 포트폴리오 패키징 (3~6개월)",
    장기: "브랜드 매니저 풀타임 트랙 진입 또는 그로스 마케터 정규직으로 전환 (12개월)",
  },
};
