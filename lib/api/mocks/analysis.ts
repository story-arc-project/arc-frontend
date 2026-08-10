// 분석 3종(개별·종합·키워드)의 mock. `USE_MOCK` 뿐 아니라 **데모 모드에서도 이 파일이 정본**이다
// (`lib/api/analysis-api.ts` 의 `USE_MOCK || isDemoMode()` 분기).
//
// ⚠️ 두 가지를 지켜야 이 데이터가 거짓말을 하지 않는다.
//
// 1) **인용문은 `lib/demo/seed.ts` 의 원문에서 그대로 따온다.** v3.1 `sourceQuotes` 와
//    v4.1 `evidence[].sourceQuote` 는 "원문 대조에 성공한 문장"이라는 뜻이고, `evidenceStatus`
//    는 그 대조 결과를 보고한다. 지어낸 문장을 넣으면 화면이 표현하려는 것과 데이터가 모순된다.
//    경험 id·제목도 시드와 1:1로 맞춘다(lib/demo/seed.test.ts 가 고정한다).
//
// 2) **이 mock 은 백엔드보다 앞서 있다.** 백엔드(`ai_analyst`)가 실제로 내보내는 것은
//    종합 v2.0 · 개별 v1.0 · 키워드 v4.1 이고, 종합 v3.1(`starAnalysisStatus`,
//    `resumeStarFormat[].sourceQuotes`/`quality`, `recommendationNotices`)은 명세만 확정된
//    상태다(types/analysis.ts 주석 참조). 데모는 프론트가 지원하는 최대치를 보여주기로 했으므로
//    v3.1 필드까지 채우되, 백엔드가 v3.1 을 내보내기 시작하면 이 파일이 기준선이 된다.

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
// totalExperiences 는 시드 경험 8건과 같아야 한다.

export const mockAnalysisHomeSummary: AnalysisHomeSummary = {
  failedTypes: [],
  experiencesFailed: false,
  stats: {
    totalExperiences: 8,
    analysisCompleted: 10,
    lastAnalysisAt: "2026-06-08T14:30:00Z",
  },
  recentIndividual: [
    {
      id: "ind-1",
      type: "individual",
      title: "자연어처리 연구실 학부 연구생 분석",
      status: "completed",
      createdAt: "2026-06-08T14:30:00Z",
      experienceCount: 1,
      isBookmarked: true,
    },
    {
      id: "ind-2",
      type: "individual",
      title: "네이버 부스트캠프 AI Tech 6기 분석",
      status: "completed",
      createdAt: "2026-06-06T10:00:00Z",
      experienceCount: 1,
      isBookmarked: false,
    },
    {
      id: "ind-3",
      type: "individual",
      title: "데이터 분석 학회 DataWave 분석",
      status: "completed",
      createdAt: "2026-06-04T16:00:00Z",
      experienceCount: 1,
      isBookmarked: false,
    },
  ],
  recentComprehensive: [
    {
      id: "comp-1",
      type: "comprehensive",
      title: "데이터 분석 직무 종합 분석",
      status: "completed",
      createdAt: "2026-06-07T12:00:00Z",
      experienceCount: 3,
      isBookmarked: true,
    },
    {
      id: "comp-2",
      type: "comprehensive",
      title: "AI/ML 엔지니어 직무 종합 분석",
      status: "completed",
      createdAt: "2026-06-05T09:00:00Z",
      experienceCount: 2,
      isBookmarked: false,
    },
  ],
  recentKeyword: [
    {
      id: "kw-1",
      type: "keyword",
      title: "'문제 해결 · 자기주도성' 키워드 분석",
      status: "completed",
      createdAt: "2026-06-03T11:00:00Z",
      experienceCount: 4,
      isBookmarked: false,
      selectedKeywords: ["문제 해결", "자기주도성"],
    },
    {
      id: "kw-2",
      type: "keyword",
      title: "'데이터 품질 · 협업' 키워드 분석",
      status: "completed",
      createdAt: "2026-06-01T15:00:00Z",
      experienceCount: 3,
      isBookmarked: true,
      selectedKeywords: ["데이터 품질", "협업"],
    },
    {
      id: "kw-3",
      type: "keyword",
      title: "'리더십 · 커뮤니케이션' 키워드 분석",
      status: "completed",
      createdAt: "2026-05-28T10:00:00Z",
      experienceCount: 3,
      isBookmarked: false,
      selectedKeywords: ["리더십", "커뮤니케이션"],
    },
  ],
  recommendations: {
    experienceGroups: [
      {
        experienceIds: ["exp-demo-career", "exp-demo-award"],
        reason: "연구실 인턴과 공모전 수상을 묶으면 '데이터로 근거를 만드는 사람'이라는 축이 또렷해져요.",
      },
      {
        experienceIds: ["exp-demo-club", "exp-demo-extracurricular"],
        reason: "학회 운영과 부스트캠프 팀 리딩을 연결하면 사람을 움직여 본 경험을 보여줄 수 있어요.",
      },
    ],
    suggestedKeywords: [
      {
        id: "sk-1",
        label: "문제 해결",
        category: "skill",
        reason: "4개 경험에서 원인을 특정하고 검증까지 이어진 서술이 발견됨",
        relatedExperienceCount: 4,
      },
      {
        id: "sk-2",
        label: "자기주도성",
        category: "work_style",
        reason: "스터디 커리큘럼 설계·온보딩 개편 등 스스로 시작한 일이 확인됨",
        relatedExperienceCount: 3,
      },
      {
        id: "sk-3",
        label: "데이터 품질",
        category: "skill",
        reason: "레이블링 기준 개정과 실험 재현성 확보가 반복해서 등장함",
        relatedExperienceCount: 3,
      },
    ],
  },
};

// ─── Individual Analysis ────────────────────────────────────

export const mockIndividualAnalysisList: AnalysisSnapshot[] = [
  {
    id: "ind-1",
    type: "individual",
    title: "자연어처리 연구실 학부 연구생",
    status: "completed",
    createdAt: "2026-06-08T14:30:00Z",
    experienceCount: 1,
    isBookmarked: true,
  },
  {
    id: "ind-2",
    type: "individual",
    title: "네이버 부스트캠프 AI Tech 6기",
    status: "completed",
    createdAt: "2026-06-06T10:00:00Z",
    experienceCount: 1,
    isBookmarked: false,
  },
  {
    id: "ind-3",
    type: "individual",
    title: "데이터 분석 학회 DataWave",
    status: "completed",
    createdAt: "2026-06-04T16:00:00Z",
    experienceCount: 1,
    isBookmarked: false,
  },
  {
    id: "ind-4",
    type: "individual",
    title: "전국 대학생 데이터 분석 공모전 우수상",
    status: "completed",
    createdAt: "2026-06-02T12:00:00Z",
    experienceCount: 1,
    isBookmarked: true,
  },
  {
    id: "ind-5",
    type: "individual",
    title: "미국 워싱턴대학교 교환학생",
    status: "completed",
    createdAt: "2026-05-30T09:00:00Z",
    experienceCount: 1,
    isBookmarked: false,
  },
];

export const mockIndividualAnalysisResult: IndividualAnalysisResult = {
  id: "ind-1",
  status: "completed",
  experienceId: "exp-demo-career",
  isBookmarked: false,
  hasResultBody: true,
  result: {
    status: "completed",
    itemName: "자연어처리 연구실 학부 연구생",
    itemType: "career",
    briefSummary:
      "모델이 아니라 데이터를 고쳐 성능을 끌어올린 연구 인턴 경험입니다. 레이블링 기준을 다시 세워 일치도를 0.61에서 0.78로 올렸고, 같은 설정이면 누구나 같은 결과를 얻도록 실험 환경을 정비했습니다.",
    deepAnalysis: {
      careerValue:
        "데이터 품질 관리와 실험 재현성은 모델링 역량보다 검증하기 어려운 축입니다. 두 가지를 수치로 증명한 이력은 ML 엔지니어·데이터 사이언티스트 지원 시 곧바로 신뢰 근거가 됩니다.",
      strengths: [
        "불일치 사례 320건을 6개 패턴으로 유형화해 판단 기준을 문서로 만든 경험",
        "seed 고정·설정 파일 분리·자동 기록으로 실험 재현성을 확보한 경험",
        "의견이 갈린 지점을 논쟁이 아니라 실험으로 결론 낸 의사결정 방식",
      ],
      limitations: [
        "모델 구조나 학습 기법을 직접 설계한 경험은 상대적으로 얇음",
        "개선된 데이터가 최종 서비스 지표로 어떻게 이어졌는지는 서술되지 않음",
      ],
      applicableRoles: ["ML 엔지니어", "데이터 사이언티스트", "NLP 리서치 엔지니어"],
      marketValue:
        "데이터 중심 접근(Data-centric AI)은 최근 채용에서 비중이 커진 축이고, 일치도·재현성처럼 정량화된 근거를 가진 지원자는 많지 않습니다.",
    },
    starFormat: {
      title: "레이블링 기준 개정으로 데이터 일치도 0.61 → 0.78",
      situation: "레이블러마다 판단이 갈려 데이터셋의 신뢰도를 보장할 수 없던 상황",
      task: "경계 사례를 줄여 같은 문장이면 같은 레이블이 붙게 만드는 것",
      action:
        "불일치 사례 320건을 6개 패턴으로 분류하고, 패턴마다 판단 기준과 예시 문장을 붙여 가이드라인을 개정한 뒤 같은 표본으로 재측정",
      result: "레이블러 간 일치도(Cohen's Kappa) 0.61 → 0.78, 풍자·인용 표현의 불일치가 가장 크게 감소",
    },
    itemDiagnosis: {
      oneLineVerdict:
        "과정과 수치가 모두 있어 드문 완성도예요. 다만 이 개선이 모델 성능까지 어떻게 이어졌는지가 비어 있어요.",
      weaknesses: [
        {
          id: "w-1",
          category: "성과 연결",
          severity: "major",
          title: "데이터 품질 개선이 모델 지표로 이어진 근거가 없음",
          diagnosis:
            "일치도는 올랐지만, 그 데이터로 학습한 모델의 성능이 얼마나 달라졌는지는 적혀 있지 않습니다.",
          evidence: "일치도(0.78)와 실험 편차(±0.004)는 있으나 최종 F1 변화는 가이드라인 개정과 분리돼 서술됨",
          impact: "'그래서 무엇이 좋아졌나'라는 후속 질문에 답하기 어려울 수 있어요.",
          priorityAction: "개정 전후 데이터로 각각 학습했을 때의 지표 차이를 한 줄 추가하기",
          improvementExample:
            "'개정 전 데이터 대비 동일 모델의 F1이 0.58 → 0.63으로 올랐습니다.'",
        },
        {
          id: "w-2",
          category: "역할 구분",
          severity: "minor",
          title: "멘토와의 역할 분담이 흐릿함",
          diagnosis:
            "실험 설계를 멘토와 합의했다고만 적혀 있어, 어디까지가 본인의 판단이었는지 읽히지 않습니다.",
          evidence: "'실험 설계는 멘토와 사전에 합의한 뒤 실행했습니다'",
          impact: "주도성을 묻는 질문에서 기여도가 낮게 읽힐 수 있음",
          priorityAction: "본인이 먼저 제안해 채택된 결정을 한 가지 명시하기",
          improvementExample: "'focal loss 적용은 제가 세미나에서 제안해 실험으로 이어졌습니다.'",
        },
      ],
      missingElements: ["개정 전후 모델 성능 비교", "데이터셋 규모(문장 수)"],
      rewriteSuggestion:
        "'레이블러 4명의 불일치 사례 320건을 6개 패턴으로 분류하고 패턴별 판단 기준과 예시를 붙여 가이드라인을 개정했습니다. 재측정 결과 Cohen's Kappa가 0.61에서 0.78로 올랐고, 같은 데이터로 학습한 모델의 F1도 함께 개선됐습니다.'",
    },
    synergyRecommendations: [
      {
        priority: "high",
        category: "성과 보강",
        name: "개정 전후 모델 성능 비교 실험",
        reason: "이미 파이프라인이 재현 가능하므로, 같은 설정으로 두 데이터셋을 돌리기만 하면 됩니다.",
        expectedEffect: "데이터 품질 개선의 효과를 최종 지표로 증명",
        estimatedDuration: "1주",
      },
      {
        priority: "medium",
        category: "외부 공유",
        name: "레이블링 가이드라인 회고 글 공개",
        reason: "판단 기준을 만드는 과정은 공개된 사례가 드물어 그 자체로 차별점이 됩니다.",
        expectedEffect: "면접에서 꺼낼 수 있는 구체적 소재 확보",
        estimatedDuration: "1주",
      },
      {
        priority: "low",
        category: "확장",
        name: "데이터 중심 AI 관련 스터디 참여",
        reason: "같은 관점을 가진 사람들과 방법론을 넓힐 수 있습니다.",
        expectedEffect: "도메인 언어 습득",
        estimatedDuration: "지속",
      },
    ],
    actionPlan: {
      shortTerm: "개정 전후 데이터로 동일 모델을 학습해 F1 차이를 기록에 추가",
      midTerm: "가이드라인 개정 과정을 회고 글로 정리해 공개",
      longTerm: "데이터 품질 관점의 기여를 오픈소스 데이터셋 프로젝트로 확장",
    },
    missingInfoWarning:
      "데이터셋 규모와 개정 전후 모델 성능이 비어 있어요. 두 가지를 채우면 이 경험의 설득력이 크게 올라갑니다.",
  },
};

// ─── Comprehensive Analysis ─────────────────────────────────

export const mockComprehensiveList: AnalysisSnapshot[] = [
  {
    id: "comp-1",
    type: "comprehensive",
    title: "데이터 분석 직무 종합 분석",
    status: "completed",
    createdAt: "2026-06-07T12:00:00Z",
    experienceCount: 3,
    isBookmarked: true,
    selectedExperienceIds: ["exp-demo-career", "exp-demo-award", "exp-demo-club"],
  },
  {
    id: "comp-2",
    type: "comprehensive",
    title: "AI/ML 엔지니어 직무 종합 분석",
    status: "completed",
    createdAt: "2026-06-05T09:00:00Z",
    experienceCount: 2,
    isBookmarked: false,
    selectedExperienceIds: ["exp-demo-career", "exp-demo-extracurricular"],
  },
  {
    id: "comp-3",
    type: "comprehensive",
    title: "글로벌 역량 종합 분석",
    status: "processing",
    createdAt: "2026-06-09T08:00:00Z",
    experienceCount: 3,
    isBookmarked: false,
  },
];

export const mockComprehensiveResult: ComprehensiveAnalysisResult = {
  id: "comp-1",
  status: "completed",
  isBookmarked: false,
  hasResultBody: true,
  experiences: [
    { id: "exp-demo-career", title: "자연어처리 연구실 학부 연구생" },
    { id: "exp-demo-award", title: "전국 대학생 데이터 분석 공모전 우수상" },
    // 삭제된 경험은 title 이 null 로 온다(계약 §2.2) — 화면이 그 상태를 어떻게 그리는지 함께 보여준다.
    { id: "exp-deleted-1", title: null },
  ],
  userSchool: "한양대학교",
  userDepartment: "컴퓨터소프트웨어학부",
  briefSummary:
    "'데이터를 믿을 수 있게 만드는 일'이 세 경험을 관통합니다. 기준을 세우고, 그 기준으로 결론을 검증하고, 결과를 남에게 설득하는 흐름이 반복돼 데이터 분석 직무 적합성이 또렷합니다.",
  detailedSummary:
    "학회에서 스터디를 운영하며 사람이 어디서 막히는지 관찰하는 습관이 생겼고, 공모전에서는 그 관찰을 데이터로 옮겨 심야 노선 후보 구간을 제안했습니다. 연구실에서는 아예 데이터의 판단 기준 자체를 다시 만들었습니다. 세 경험 모두 정량 근거(이탈률 40%→12%, 187팀 중 2위, 일치도 0.61→0.78)를 갖췄다는 점이 강점입니다. 반면 분석 결과가 실제 의사결정으로 이어진 뒤의 이야기는 대부분 비어 있습니다.",
  keywordClustering: {
    personalityTendency: ["검증 지향", "책임감", "관찰형"],
    coreCompetency: ["데이터 품질 관리", "공공데이터 분석", "실험 재현성", "커리큘럼 설계"],
    jobIndustry: ["데이터 분석", "데이터 사이언스", "AI 연구 지원"],
  },
  experienceInsights: {
    motivation:
      "숫자가 맞는지 스스로 확인해야 마음이 놓이는 성향이 반복해 드러납니다. 결론을 내기 전에 기준부터 세우려는 태도가 세 경험 모두에서 확인됩니다.",
    learningPoints:
      "판단 기준을 문서로 만드는 법, 결과를 재현 가능하게 남기는 법, 그리고 같은 데이터를 다르게 보여주면 설득력이 달라진다는 점을 핵심 학습으로 정리할 수 있습니다.",
  },
  synergyCombinations: [
    {
      combinationTitle: "기준 설계 + 공공데이터 검증",
      items: ["자연어처리 연구실 학부 연구생", "전국 대학생 데이터 분석 공모전 우수상"],
      synergyReason:
        "레이블링 기준을 만든 경험과 분석 기준의 오류를 스스로 발견한 경험이 겹쳐, '데이터를 의심할 줄 아는 분석가'라는 한 문장으로 묶입니다.",
      expectedEffect: "데이터 신뢰성 축에서 다른 지원자와 갈림",
      applicableRoles: ["데이터 분석가", "데이터 사이언티스트"],
    },
    {
      combinationTitle: "스터디 운영 + 분석 결과 전달",
      items: ["데이터 분석 학회 DataWave", "전국 대학생 데이터 분석 공모전 우수상"],
      synergyReason:
        "사람이 어디서 막히는지 보고 커리큘럼을 고친 경험이, 심사위원을 설득한 발표 경험과 같은 근육을 씁니다.",
      expectedEffect: "분석을 넘어 전달까지 가능한 사람으로 읽힘",
      applicableRoles: ["데이터 분석가", "비즈니스 애널리스트"],
    },
  ],
  additionalRecommendations: {
    certifications: [
      {
        name: "ADsP (데이터분석 준전문가)",
        reason: "이미 보유한 SQLD 다음 단계로, 통계·분석 기획까지 범위를 넓힐 수 있습니다.",
        expectedEffect: "데이터 분석 직무 지원 시 기본기 증빙 보강",
        estimatedDuration: "1~2개월",
        url: "https://www.dataq.or.kr",
        issuer: "한국데이터산업진흥원",
      },
      {
        name: "SQLP (SQL 전문가)",
        reason: "본인이 활용 계획으로 직접 언급한 자격증입니다.",
        expectedEffect: "쿼리 최적화 역량을 공식 근거로 확보",
        estimatedDuration: "4~6개월",
        url: null,
        issuer: "한국데이터산업진흥원",
      },
    ],
    clubsAndSocieties: [
      {
        name: "가짜연구소 (Pseudo Lab)",
        type: "연합동아리",
        schoolAffiliation: "전국 (온라인)",
        description: "머신러닝·데이터 분야 오픈 스터디와 논문 리뷰를 진행하는 커뮤니티",
        reason: "학회 운영 경험을 교외 커뮤니티로 넓혀 외부 네트워크를 만들 수 있습니다.",
        expectedEffect: "교내를 벗어난 협업 근거 확보",
        url: "https://pseudo-lab.com",
        searchQuery: "가짜연구소 스터디 모집",
        searchVerified: true,
        urlNote: "",
      },
      {
        name: "교내 데이터 저널리즘 소모임",
        type: "교내동아리",
        schoolAffiliation: "한양대학교",
        description: "데이터 기반 기사·시각화를 함께 만드는 학내 소모임",
        reason: "시각화 작업물과 결이 맞고, 전달 역량을 계속 쓸 수 있는 자리입니다.",
        expectedEffect: "분석-전달 축의 지속 근거",
        url: null,
        searchQuery: "",
        searchVerified: false,
        // v3.1: 링크 검증에 실패하면 안내 문구가 링크 자리를 채운다.
        urlNote: "직접 확인하십시오: 한양대 데이터 저널리즘 소모임 모집",
      },
    ],
    projectsAndContests: [
      {
        name: "공공데이터 활용 창업·아이디어 공모전",
        organizer: "행정안전부",
        reason: "이미 다뤄본 공공데이터 도메인을 확장할 수 있습니다.",
        expectedEffect: "수상 이력을 한 축으로 모아 일관성 강화",
        url: "https://www.data.go.kr",
        deadline: null,
        isRegular: true,
      },
    ],
  },
  resumeStarFormat: [
    {
      title: "레이블링 기준 개정으로 데이터 일치도 0.61 → 0.78",
      headline: "판단이 갈리던 320건을 6개 패턴으로 정리해 데이터 신뢰도를 끌어올림",
      situation: "레이블러마다 판단이 갈려 데이터셋의 신뢰도를 보장할 수 없던 상황",
      task: "경계 사례를 줄여 같은 문장이면 같은 레이블이 붙게 만드는 것",
      action:
        "불일치 사례 320건을 유형별로 모아 6개 패턴으로 분류하고, 패턴마다 판단 기준과 예시 문장을 붙여 가이드라인을 개정한 뒤 같은 표본으로 재측정",
      result: "레이블러 간 일치도(Cohen's Kappa)가 0.61에서 0.78로 상승",
      learning: "모델을 바꾸는 것보다 판단 기준을 다시 세우는 편이 점수를 올렸다는 것",
      // 아래 인용은 모두 seed.ts 의 career 경험 원문 그대로다.
      // ⚠️ 슬롯마다 **다른 문장**을 인용해야 한다 — 같은 문장을 두 슬롯에 쓰면 그건 재배치이고,
      // 아래 evidenceStatus 가 "슬롯 분리성 통과"라고 보고하는 것과 모순된다.
      sourceQuotes: {
        situation: "'인용된 혐오 표현'을 혐오로 볼지 의견이 갈려 2주간 결론이 나지 않았습니다.",
        task: "레이블러마다 판단이 갈리는 경계 사례를 줄여 데이터셋의 신뢰도를 확보하는 것",
        action:
          "레이블러 4명의 불일치 사례 320건을 유형별로 모아 6개 패턴으로 분류했고, 각 패턴마다 판단 기준과 예시 문장을 붙여 가이드라인을 개정했습니다.",
        result: "레이블러 간 일치도(Cohen's Kappa)가 0.61에서 0.78로 올랐습니다.",
        learning:
          "처음에는 모델을 바꾸면 성능이 오를 거라 생각했는데, 실제로 점수를 끌어올린 것은 경계 사례를 다시 정의한 가이드라인이었습니다.",
      },
      competencyEvidence: [
        {
          competency: "문제 해결",
          why: "불일치를 감으로 줄이지 않고 320건을 패턴으로 유형화해 원인부터 정리했습니다.",
        },
        {
          competency: "데이터 품질 관리",
          why: "개정 후 같은 표본으로 재측정해 개선을 수치로 확인했습니다.",
        },
      ],
      evidenceStatus: {
        supportedSlots: ["S", "T", "A", "R", "L"],
        unsupportedSlots: [],
        restructuringOnly: false,
        restructuringDetail: [],
      },
      qualityWarning: "",
      quality: {
        grade: "A",
        score: "9/10",
        verdict: "행동과 결과가 원문 근거로 잘 묶여 있어 그대로 써도 좋아요.",
        criteria: [
          {
            key: "action_dominant",
            label: "Action 비중",
            passed: true,
            detail: "Action 이 전체의 46% (권장 40~50%)",
            coaching: "",
          },
          {
            key: "result_quantified",
            label: "결과 수치화",
            passed: true,
            detail: "일치도 0.61 → 0.78 수치 제시",
            coaching: "",
          },
          {
            key: "slots_distinct",
            label: "슬롯 분리성",
            passed: true,
            detail: "상황·과제·행동이 서로 다른 문장에서 파생됨",
            coaching: "",
          },
        ],
        priorityFixes: [],
        derivedFieldNotes: [],
      },
    },
    {
      // 근거는 충분한데 슬롯 간 인용이 겹치는 경우 — 재배치 경고가 실제로 뜨는 자리다.
      title: "SQL 스터디 커리큘럼 개편으로 중도 이탈률 40% → 12%",
      headline: "이탈이 몰리는 3주차를 찾아 과제 구조를 바꿔 완주율을 끌어올림",
      situation: "3주차부터 난이도가 급격히 올라 스터디 이탈이 몰리던 상황",
      task: "3주차 이탈을 줄여 최소 진도만 따라와도 완주할 수 있게 만드는 것",
      action: "과제를 '필수 3문제 + 선택 3문제'로 나눠 최소 진도만으로도 완주 가능한 구조로 변경",
      result: "이전 학기 중도 이탈률 40%에서 12%로 감소, 수료자 12명 중 5명이 공모전 팀 합류",
      learning: "",
      sourceQuotes: {
        situation: "3주차부터 난이도가 급격히 올라 이탈이 몰렸습니다.",
        task: "3주차부터 난이도가 급격히 올라 이탈이 몰렸습니다.",
        action:
          "과제를 '필수 3문제 + 선택 3문제'로 나눠 최소 진도만 따라와도 완주할 수 있게 바꿨습니다.",
        result: "이전 학기 중도 이탈률 40%에서 12%로 낮췄습니다.",
        learning: "",
      },
      competencyEvidence: [
        {
          competency: "관찰 기반 개선",
          why: "이탈이 몰리는 지점을 특정한 뒤 구조를 바꿨습니다.",
        },
      ],
      evidenceStatus: {
        supportedSlots: ["S", "A", "R"],
        unsupportedSlots: [
          {
            slot: "T",
            label: "과제",
            reason: "상황과 같은 문장에서 파생돼 별도 근거로 보기 어렵습니다.",
            claimedQuote: "3주차부터 난이도가 급격히 올라 이탈이 몰렸습니다.",
          },
        ],
        // 슬롯 간 인용 중복도가 60% 를 넘었다 — 새로 쓴 게 아니라 입력을 재배치한 수준이라는 신호.
        restructuringOnly: true,
        restructuringDetail: ["S↔T (100% 중복)"],
      },
      qualityWarning:
        "입력 문장을 슬롯별로 재배치한 수준이에요. 과제와 상황을 다른 문장으로 나눠 적으면 훨씬 또렷해집니다.",
      quality: {
        grade: "B",
        score: "7/10",
        verdict: "성과가 분명해요. 상황과 과제만 나눠 적으면 바로 쓸 수 있어요.",
        criteria: [
          {
            key: "result_quantified",
            label: "결과 수치화",
            passed: true,
            detail: "이탈률 40% → 12% 수치 제시",
            coaching: "",
          },
          {
            key: "action_dominant",
            label: "Action 비중",
            passed: true,
            detail: "Action 이 전체의 41% (권장 40~50%)",
            coaching: "",
          },
          {
            key: "slots_distinct",
            label: "슬롯 분리성",
            passed: false,
            detail: "상황과 과제 문장이 100% 겹침",
            coaching: "'왜 문제였는지'와 '내가 맡은 일'을 다른 문장으로 나눠보세요.",
          },
        ],
        priorityFixes: ["'왜 문제였는지'와 '내가 맡은 일'을 다른 문장으로 나눠보세요."],
        derivedFieldNotes: ["배움(L) 삭제: 원문에 회고가 명시되지 않았습니다."],
      },
    },
    {
      title: "심야 노선 후보 구간 3곳 제안으로 공모전 우수상",
      headline: "",
      situation: "심야 버스 노선이 실제 수요와 맞는지 검증된 적 없던 상황",
      task: "대중교통·상권 데이터를 결합해 수요가 몰리는 구간을 찾는 것",
      action: "승하차 데이터와 상권 매출 데이터를 결합·정제하고 시간대별 수요 밀도를 분석",
      result: "기존 노선과 다른 3개 구간을 제안해 187팀 중 우수상(2위)",
      learning: "",
      sourceQuotes: {
        situation: "",
        task: "",
        action:
          "대중교통 승하차 데이터와 상권 매출 데이터를 결합해 '심야 버스 노선이 실제로 필요한 구간'을 찾는 분석으로 수상했습니다.",
        result:
          "기존 노선 기준과 다른 3개 구간을 제안했고, 심사위원으로부터 근거의 구체성과 정책 적용 가능성에서 높은 평가를 받았습니다.",
        learning: "",
      },
      competencyEvidence: [
        {
          competency: "분석 설계",
          why: "서로 다른 두 데이터를 결합해 새로운 판단 근거를 만들었습니다.",
        },
      ],
      evidenceStatus: {
        supportedSlots: ["A", "R"],
        unsupportedSlots: [
          {
            slot: "S",
            label: "상황",
            reason: "원문에서 '어떤 문제 상황이었는지'로 볼 문장을 찾지 못했습니다.",
            claimedQuote: "",
          },
          {
            slot: "T",
            label: "과제",
            reason: "원문에서 '내가 맡은 과제'로 볼 문장을 찾지 못했습니다.",
            claimedQuote: "",
          },
        ],
        restructuringOnly: false,
        restructuringDetail: [],
      },
      qualityWarning: "",
      quality: {
        grade: "C",
        score: "5/10",
        verdict: "결과는 뚜렷한데, 어떤 문제에서 출발했는지가 비어 있어요.",
        criteria: [
          {
            key: "result_quantified",
            label: "결과 수치화",
            passed: true,
            detail: "187팀 중 2위, 제안 구간 3곳 제시",
            coaching: "",
          },
          {
            key: "context_concise",
            label: "Context 명확성",
            passed: false,
            detail: "분석을 시작하게 된 문제 상황이 서술되지 않음",
            coaching: "왜 이 분석이 필요했는지 한 문장만 앞에 붙여보세요.",
          },
          {
            key: "action_dominant",
            label: "Action 비중",
            passed: false,
            detail: "Action 이 전체의 24% (권장 40~50%)",
            coaching: "데이터를 어떤 순서로 결합하고 무엇을 기준으로 판단했는지 더 적어보세요.",
          },
        ],
        priorityFixes: [
          "왜 이 분석이 필요했는지 한 문장만 앞에 붙여보세요.",
          "데이터를 어떤 순서로 결합하고 무엇을 기준으로 판단했는지 더 적어보세요.",
        ],
        derivedFieldNotes: [
          "한 줄 성취문(headline) 삭제: 원문에 없는 수치가 섞여 생성이 취소됐습니다.",
          "배움(L) 삭제: 원문에 회고가 명시되지 않았습니다.",
        ],
      },
    },
  ],
  starAnalysisStatus: {
    present: true,
    generated: true,
    reason: "",
    experienceBlockCount: 4,
    starEligibleBlockCount: 3,
    coaching: [],
    rejectedEntries: [
      {
        title: "SQL 개발자 (SQLD)",
        reason: "자격 취득 기록이라 '무엇을 했고 무엇이 달라졌는지'로 볼 문장을 찾지 못했습니다.",
        unsupportedSlots: ["A", "R"],
        coaching:
          "이 자격증을 실제로 써서 해결한 일이 있다면 그 사례를 따로 적어보세요. STAR 로 만들 수 있어요.",
      },
    ],
    qualityReview: {
      evaluated: 3,
      gradeDistribution: { A: 1, B: 1, C: 1 },
      portfolioVerdict: "한 건은 그대로 써도 좋고, 두 건은 출발점만 채우면 크게 좋아져요.",
      topFixes: ["슬롯 분리성 — 3건 중 2건에서 미달", "Context 명확성 — 3건 중 1건에서 미달"],
    },
  },
  actionPlan: {
    shortTerm: "각 경험의 시작점(어떤 문제였는지)을 한 문장씩 앞에 붙이기",
    midTerm: "분석 결과가 실제 결정으로 이어진 사례를 1건 확보하기",
    longTerm: "공공데이터 도메인에서 분석-제안-검증을 완결한 프로젝트 만들기",
  },
  strengthDiagnosis: {
    oneLineVerdict:
      "세 경험 모두 '기준을 세우고 수치로 확인한다'는 같은 태도를 보여줘요. 신입 지원자에게 드문 일관성이에요.",
    strengths: [
      {
        id: "s-1",
        category: "직무_연관성",
        level: "outstanding",
        title: "데이터 신뢰성이라는 일관된 축",
        diagnosis:
          "레이블링 기준 개정, 분석 기준 오류 발견, 스터디 이탈 원인 파악까지 모두 '기준을 의심하고 다시 세우는' 행동입니다.",
        evidence: "3개 경험 모두에서 기준을 점검한 뒤 결론을 낸 서술이 확인됨",
        impact: "데이터 직무에서 가장 검증하기 어려운 축을 근거로 갖게 됨",
        leverageAction: "자기소개서 첫 문단을 이 축으로 열어보세요.",
      },
      {
        id: "s-2",
        category: "서류_품질",
        level: "strong",
        title: "정량 근거의 밀도",
        diagnosis:
          "일치도 0.61→0.78, 이탈률 40%→12%, 187팀 중 2위처럼 비교 가능한 수치가 경험마다 있습니다.",
        evidence: "3개 경험 전부에 전후 비교 또는 순위 수치가 존재",
        impact: "면접에서 성과를 구체적으로 설명하기 유리",
        leverageAction: "수치가 나온 조건(표본 수·기간)도 한 줄씩 덧붙이세요.",
      },
      {
        id: "s-3",
        category: "활동_깊이",
        level: "notable",
        title: "문제를 실험으로 결론 내는 습관",
        diagnosis: "의견이 갈렸을 때 논쟁 대신 두 기준으로 각각 재보고 결과로 정한 사례가 있습니다.",
        evidence: "'두 기준으로 각각 레이블링해 성능 차이를 재고, 그 결과를 근거로 기준을 정했습니다'",
        impact: "협업 상황에서의 의사결정 방식을 보여줄 수 있음",
        leverageAction: "이 사례를 협업 관련 면접 질문의 기본 답변으로 준비하세요.",
      },
    ],
    noStrengthDiagnosis: {
      hasIssue: false,
      reason: "",
      improvementDirection: "",
    },
    standoutExperienceTypes: ["인턴 및 업무 경력", "수상 경력"],
    contentQualityHighlights: [
      {
        item: "'레이블링 기준 개정' 항목",
        highlight: "불일치 320건 → 6개 패턴 → 재측정으로 이어지는 과정이 그대로 적혀 있음",
        whyEffective: "결과만이 아니라 판단의 순서가 보여 재현 가능한 역량으로 읽힘",
      },
      {
        item: "'본선 3일 전 기준 시간대 오류 발견' 항목",
        highlight: "불리한 사실을 숨기지 않고 발견-수정 과정을 함께 서술",
        whyEffective: "검증 태도를 말이 아니라 사건으로 증명함",
      },
    ],
    competitorAdvantage:
      "같은 학번 데이터 직무 지원자 대비, 분석 기법의 다양성보다 '결과를 믿을 수 있게 만드는 과정'에서 앞섭니다.",
  },
  criticalDiagnosis: {
    oneLineVerdict:
      "분석까지는 촘촘한데 그 뒤가 비어 있어요. 결과가 누구의 어떤 결정을 바꿨는지가 세 경험 모두에서 빠져 있어요.",
    weaknesses: [
      {
        id: "cw-1",
        category: "활동_깊이",
        severity: "critical",
        title: "분석 이후의 이야기가 없음",
        diagnosis:
          "제안한 3개 구간이 어떻게 됐는지, 개정한 가이드라인이 이후 어떻게 쓰였는지가 서술되지 않았습니다.",
        evidence: "세 경험 모두 결과 수치에서 서술이 끝남",
        impact: "'분석은 잘하지만 실행까지는 모르겠다'는 인상을 줄 수 있어요.",
        priorityAction: "각 경험에 '그 뒤에 무엇이 달라졌는지' 한 줄씩 추가",
      },
      {
        id: "cw-2",
        category: "스킬_보유",
        severity: "major",
        title: "통계적 검증 방법이 드러나지 않음",
        diagnosis:
          "수요 밀도·상관관계를 다뤘다고 했지만 어떤 방법으로 유의성을 확인했는지는 적혀 있지 않습니다.",
        evidence: "분석 서술에 사용한 통계 기법이 명시되지 않음",
        impact: "데이터 분석 직무 기술 면접에서 근거를 대기 어려울 수 있음",
        priorityAction: "사용한 검정·모델과 그 선택 이유를 한 줄씩 명시",
      },
    ],
    missingExperienceTypes: ["실무 데이터 인턴", "외부 발표·기고"],
    contentQualityIssues: [
      {
        item: "'심야 대중교통 수요 분석' 항목",
        issue: "결합한 두 데이터의 규모와 기간이 적혀 있지 않음",
        improvementHint: "'2023~2025년 승하차 데이터 N건' 식으로 범위를 명시",
      },
    ],
    competitorGap:
      "비슷한 지원자 대비 분석 과정의 신뢰도는 앞서지만, 분석 결과의 활용까지 이어진 사례 수는 평균 수준입니다.",
  },
  verifiedJobs: [
    {
      company: "토스",
      role: "데이터 분석가 (신입)",
      deadline: "2026-12-30",
      whyMatch: "공공데이터 결합 분석과 SQL 기반 검증 경험이 직무 요건과 직접 연결됩니다.",
      url: "https://example.com/jobs/toss-data",
      isValid: true,
    },
    {
      company: "우아한형제들",
      role: "데이터 사이언티스트 (신입)",
      deadline: "상시채용",
      whyMatch: "데이터 품질 관리와 실험 재현성 경험이 실험 기반 조직과 잘 맞습니다.",
      url: "https://example.com/jobs/woowa-ds",
      isValid: true,
    },
  ],
  expiredJobs: [
    {
      company: "카카오",
      role: "데이터 분석가 (신입)",
      deadline: "2026-05-30",
      whyMatch: "분석-제안 경험과 맞으나 마감이 지났습니다.",
      url: "https://example.com/jobs/kakao-data",
    },
  ],
  recommendationNotices: [
    "공모전은 마감일이 확인된 항목만 남겨 1건만 추천합니다.",
  ],
  missingInfoWarning:
    "분석 이후의 활용, 사용한 통계 기법, 데이터 규모가 비어 있어요. 채워주시면 분석 정확도가 더 올라갑니다.",
};

// ─── Keyword Analysis ───────────────────────────────────────

export const mockKeywordSuggestions: KeywordSuggestion[] = [
  {
    id: "ks-1",
    label: "문제 해결",
    category: "skill",
    reason: "4개 경험에서 원인 특정 → 조치 → 검증 흐름이 발견됨",
    relatedExperienceCount: 4,
  },
  {
    id: "ks-2",
    label: "데이터 품질",
    category: "skill",
    reason: "레이블링 기준 개정과 실험 재현성 확보가 반복 등장",
    relatedExperienceCount: 3,
  },
  {
    id: "ks-3",
    label: "자기주도성",
    category: "work_style",
    reason: "스터디 커리큘럼 설계·온보딩 개편 등 스스로 시작한 일이 확인됨",
    relatedExperienceCount: 3,
  },
  {
    id: "ks-4",
    label: "협업",
    category: "work_style",
    reason: "팀 리딩과 학회 운영에서 역할 분담·조율 이력",
    relatedExperienceCount: 4,
  },
  {
    id: "ks-5",
    label: "성장 지향",
    category: "value",
    reason: "정회원 → 스터디장 → 학회장으로 이어지는 역할 변화가 확인됨",
    relatedExperienceCount: 5,
  },
  {
    id: "ks-6",
    label: "데이터 분석",
    category: "job_domain",
    reason: "공공데이터·연구 데이터·매출 데이터를 다룬 경험 다수",
    relatedExperienceCount: 4,
  },
];

export const mockKeywordList: AnalysisSnapshot[] = [
  {
    id: "kw-1",
    type: "keyword",
    title: "'문제 해결 · 자기주도성' 키워드 분석",
    status: "completed",
    createdAt: "2026-06-03T11:00:00Z",
    experienceCount: 4,
    isBookmarked: false,
    selectedKeywords: ["문제 해결", "자기주도성"],
  },
  {
    id: "kw-2",
    type: "keyword",
    title: "'데이터 품질 · 협업' 키워드 분석",
    status: "completed",
    createdAt: "2026-06-01T15:00:00Z",
    experienceCount: 3,
    isBookmarked: true,
    selectedKeywords: ["데이터 품질", "협업"],
  },
  {
    id: "kw-3",
    type: "keyword",
    title: "'리더십 · 커뮤니케이션' 키워드 분석",
    status: "completed",
    createdAt: "2026-05-28T10:00:00Z",
    experienceCount: 3,
    isBookmarked: false,
    selectedKeywords: ["리더십", "커뮤니케이션"],
  },
];

export const mockKeywordResult: KeywordAnalysisResult = {
  id: "kw-1",
  status: "completed",
  isBookmarked: false,
  hasResultBody: true,
  analysisDate: "2026-06-03T11:00:00Z",
  analysisMode: "knn",
  keywords: ["문제 해결", "자기주도성"],
  targetScenario: "데이터 분석 직무 신입 지원",
  keywordDefinitions: [
    {
      keyword: "문제 해결",
      definition: "문제의 원인을 분석하고, 적절한 방법론을 선택해 실행 가능한 해결책을 도출하는 능력",
      synonyms: ["트러블슈팅", "분석적 사고", "원인 규명"],
      complianceCriteria: [
        {
          id: 1,
          criterion: "문제를 정의하고 원인을 파악한 경험이 있는가",
          signalDescription: "장애·오류·병목의 원인을 구체적으로 특정한 서술",
        },
        {
          id: 2,
          criterion: "복수의 해결 방안을 비교 검토한 경험이 있는가",
          signalDescription: "선택지를 나열하고 트레이드오프를 따진 흔적",
        },
        {
          id: 3,
          criterion: "해결 결과를 정량적으로 검증한 경험이 있는가",
          signalDescription: "수치·지표로 개선을 확인한 서술",
        },
        {
          id: 4,
          criterion: "불리한 사실을 발견하고 스스로 바로잡은 사례가 있는가",
          signalDescription: "자신의 오류를 발견해 결과를 수정한 서술",
        },
      ],
    },
    {
      keyword: "자기주도성",
      definition: "외부의 지시 없이 스스로 목표를 설정하고, 계획하고, 실행하며 완수하는 능력",
      synonyms: ["자기 동기부여", "주도성", "독립적 실행"],
      complianceCriteria: [
        {
          id: 1,
          criterion: "스스로 일을 시작하고 완수한 경험이 있는가",
          signalDescription: "지시 없이 착수해 결과물까지 낸 서술",
        },
        {
          id: 2,
          criterion: "목표를 스스로 설정하고 조정한 경험이 있는가",
          signalDescription: "목표·범위를 스스로 정하고 바꾼 흔적",
        },
        {
          id: 3,
          criterion: "관찰을 근거로 방식을 바꾼 사례가 있는가",
          signalDescription: "사람·데이터를 관찰해 방법을 개선한 서술",
        },
        {
          id: 4,
          criterion: "중도 포기 없이 결과물을 완성한 경험이 있는가",
          signalDescription: "완성된 산출물(문서·대시보드·전시물 등) 존재",
        },
      ],
    },
  ],
  selectionCriteria: {
    summary:
      "선택된 키워드('문제 해결', '자기주도성')와 관련된 행동·성과·역할 서술이 포함된 경험을 우선 선별했습니다. 근거가 얇은 2개 경험은 제외했습니다.",
    criteria: [
      "단순 참여보다 구체적 행동과 결과가 있는 경험에 높은 가중치 부여",
      "원인 규명과 검증이 함께 서술된 경험 우선",
      "정량적 성과가 명시된 경험 우선",
    ],
  },
  coverage: [
    {
      keyword: "문제 해결",
      relatedCount: 4,
      totalCount: 8,
      coveragePercent: 50,
      highCount: 3,
      mediumCount: 1,
      lowCount: 0,
    },
    {
      keyword: "자기주도성",
      relatedCount: 3,
      totalCount: 8,
      coveragePercent: 38,
      highCount: 2,
      mediumCount: 0,
      lowCount: 1,
    },
  ],
  matchedExperiences: [
    {
      keyword: "문제 해결",
      experiences: [
        {
          careerTitle: "자연어처리 연구실 학부 연구생",
          organization: "한양대학교 자연어처리 연구실 (NLP Lab)",
          period: "2025.09 - 2026.02",
          relevance: "high",
          relevanceSummary:
            "불일치의 원인을 유형화하고, 조치 후 같은 표본으로 재측정해 개선을 수치로 확인한 완결형 사례",
          evidence: [
            {
              type: "행동",
              content: "불일치 사례 320건을 6개 패턴으로 분류해 원인을 특정",
              sourceQuote:
                "레이블러 4명의 불일치 사례 320건을 유형별로 모아 6개 패턴으로 분류했고, 각 패턴마다 판단 기준과 예시 문장을 붙여 가이드라인을 개정했습니다.",
            },
            {
              type: "성과",
              content: "재측정으로 일치도 0.61 → 0.78 확인",
              sourceQuote: "레이블러 간 일치도(Cohen's Kappa)가 0.61에서 0.78로 올랐습니다.",
            },
            {
              type: "행동",
              content: "의견이 갈린 기준을 두 갈래로 각각 실험해 결론",
              sourceQuote:
                "판단을 미루는 대신 두 기준으로 각각 레이블링해 성능 차이를 재고, 그 결과를 근거로 기준을 정했습니다.",
            },
          ],
          matchedCriteria: [1, 2, 3],
          confidence: "high",
          confidenceReason: "원인-조치-검증이 모두 원문에 있고 수치가 전후 비교로 제시됨",
          isReferenceOnly: false,
        },
        {
          careerTitle: "전국 대학생 데이터 분석 공모전 우수상",
          organization: "한국데이터산업진흥원",
          period: "2025.09 - 2025.11",
          relevance: "high",
          relevanceSummary: "자신의 분석 오류를 스스로 발견해 결과를 다시 산출한 사례",
          evidence: [
            {
              type: "사건",
              content: "본선 직전 기준 시간대 오류를 발견하고 결과를 재산출",
              sourceQuote:
                "본선 사흘 전에 우리 분석의 기준 시간대가 잘못 설정된 걸 발견했습니다. 결과를 다시 뽑으니 제안 구간 하나가 바뀌었고, 그대로 발표 자료를 고쳤습니다.",
            },
          ],
          matchedCriteria: [1, 4],
          confidence: "high",
          confidenceReason: "오류 발견부터 수정까지의 과정이 구체적으로 서술됨",
          isReferenceOnly: false,
        },
        {
          careerTitle: "네이버 부스트캠프 AI Tech 6기",
          organization: "네이버 커넥트재단",
          period: "2025.07 - 2025.11",
          relevance: "high",
          relevanceSummary: "검증-리더보드 점수 괴리의 원인을 데이터 분할에서 찾아낸 사례",
          evidence: [
            {
              type: "행동",
              content: "같은 사람의 사진이 학습·검증에 섞인 것을 원인으로 특정하고 분할 기준을 변경",
              sourceQuote:
                "같은 사람의 사진이 학습·검증에 나뉘어 들어간 것이 문제였고, 사람 단위로 데이터를 나눠 해결했습니다.",
            },
          ],
          matchedCriteria: [1],
          confidence: "high",
          confidenceReason: "원인과 조치가 명확히 대응됨",
          isReferenceOnly: false,
        },
        {
          careerTitle: "데이터 분석 학회 DataWave",
          organization: "한양대학교",
          period: "2023.03 - 2025.12",
          relevance: "medium",
          relevanceSummary: "이탈이 몰리는 지점을 파악해 과제 구조를 바꾼 사례",
          evidence: [
            {
              type: "행동",
              content: "3주차 난이도 급상승을 원인으로 보고 과제를 필수/선택으로 분리",
              sourceQuote:
                "과제를 '필수 3문제 + 선택 3문제'로 나눠 최소 진도만 따라와도 완주할 수 있게 바꿨습니다.",
            },
          ],
          matchedCriteria: [1, 3],
          confidence: "medium",
          confidenceReason: "조치와 결과는 있으나 원인 분석 근거가 관찰에 그침",
          isReferenceOnly: false,
        },
      ],
    },
    {
      keyword: "자기주도성",
      experiences: [
        {
          careerTitle: "데이터 분석 학회 DataWave",
          organization: "한양대학교",
          period: "2023.03 - 2025.12",
          relevance: "high",
          relevanceSummary:
            "지시 없이 커리큘럼을 직접 설계하고, 설문으로 근거를 만들어 온보딩까지 다시 짠 사례",
          evidence: [
            {
              type: "행동",
              content: "8주 커리큘럼을 직접 설계하고 매주 실습 문제를 제작",
              sourceQuote: "커리큘럼을 8주로 설계하고 매주 실습 문제를 직접 만들었습니다.",
            },
            {
              type: "행동",
              content: "설문 62건을 근거로 모집 방식이 아니라 내용을 먼저 개편",
              sourceQuote:
                "설문 62건을 받아 '무엇을 배우는지 모르겠다'는 응답이 가장 많은 걸 확인하고, 지난 학기 결과물 8개를 정리한 소개 페이지를 만들었습니다.",
            },
            {
              type: "성과",
              content: "지원자 24명 → 41명, 초기 이탈 9명 → 3명",
              sourceQuote: "지원자가 24명에서 41명으로 늘었고, 첫 4주 이탈이 9명에서 3명으로 줄었습니다.",
            },
          ],
          matchedCriteria: [1, 3, 4],
          confidence: "high",
          confidenceReason: "착수·근거 수집·결과가 모두 원문에 있음",
          isReferenceOnly: false,
        },
        {
          careerTitle: "서울 심야 이동 인터랙티브 데이터 시각화",
          organization: "팀 작업 (3인) · 교내 전시",
          period: "2026.03 - 2026.05",
          relevance: "high",
          relevanceSummary: "아쉬움을 스스로 과제로 삼아 시작하고 전시까지 완성한 사례",
          evidence: [
            {
              type: "행동",
              content: "읽히지 않는 화면을 발견하고 슬라이더 도입으로 정보량을 조절",
              sourceQuote:
                "초기에는 모든 노선을 한 번에 보여줬는데 아무것도 읽히지 않아, 시간대 슬라이더를 넣어 한 번에 한 시점만 보이도록 바꿨습니다.",
            },
          ],
          matchedCriteria: [1, 2, 4],
          confidence: "high",
          confidenceReason: "착수 동기와 완성된 산출물(전시)이 함께 확인됨",
          isReferenceOnly: false,
        },
        {
          careerTitle: "영어 — 논문 독해와 실무 소통",
          organization: "개인 학습",
          period: "2023.03 - 2025.06",
          relevance: "low",
          relevanceSummary:
            "2년간의 습관은 확인되나 목표 조정이나 산출물 서술이 없어 참고용으로만 반영",
          evidence: [
            {
              type: "행동",
              content: "매일 논문 초록 요약 습관을 2년간 유지",
              sourceQuote: "매일 논문 초록 하나를 읽고 세 문장으로 요약하는 습관을 2년간 이어갔습니다.",
            },
          ],
          matchedCriteria: [1],
          confidence: "low",
          confidenceReason: "지속성은 있으나 결과물·조정 근거가 없음",
          isReferenceOnly: true,
        },
      ],
    },
  ],
  storylines: [
    {
      keyword: "자기주도성",
      storylineTitle: "따라가던 스터디에서 커리큘럼을 만드는 사람으로",
      tagline: "관찰을 근거로 방식을 바꿔온 3년",
      timelineStatus: "시간순_확인됨",
      timelineNote: null,
      chronologicalSequence: [
        { order: 1, experience: "데이터 분석 학회 DataWave 정회원", period: "2023-03", isDated: true },
        { order: 2, experience: "미국 워싱턴대학교 교환학생", period: "2024-08", isDated: true },
        { order: 3, experience: "DataWave 스터디장 · 학회장", period: "2024-03", isDated: true },
        { order: 4, experience: "서울 심야 이동 인터랙티브 데이터 시각화", period: "2026-03", isDated: true },
      ],
      narrative:
        "처음에는 스터디를 따라가는 것도 벅찼다. 이듬해 스터디장을 맡으면서 관점이 바뀌었다 — 사람들이 어디서 멈추는지 보이기 시작했고, 3주차에 이탈이 몰린다는 것을 확인한 뒤 과제를 필수와 선택으로 나눴다. 학회장이 된 해에는 모집이 안 되는 이유를 추측하지 않고 설문 62건으로 확인한 다음, 홍보가 아니라 내용을 고쳤다. 같은 태도가 마지막에는 개인 작업으로 이어졌다. 공모전에서 다룬 데이터가 표 안에만 남는 게 아쉬워 시각화를 시작했고, 읽히지 않는 화면을 스스로 발견해 구조를 갈아엎은 뒤 전시까지 완성했다.",
      turningPoints: [
        {
          experience: "DataWave 스터디장",
          period: "2024-03",
          trigger: "3주차부터 이탈이 몰린다는 것을 확인한 순간",
          whatChanged: "커리큘럼을 '가르치는 순서'가 아니라 '따라올 수 있는 구조'로 다시 봄",
        },
        {
          experience: "미국 워싱턴대학교 교환학생",
          period: "2024-08",
          trigger: "결론보다 데이터 분할 과정을 먼저 묻는 팀원을 만난 일",
          whatChanged: "발표에서 과정을 먼저 보여주는 방식으로 순서를 바꿈",
        },
      ],
      connectiveLogic: [
        {
          fromExperience: "DataWave 스터디장",
          toExperience: "DataWave 학회장",
          relationType: "심화",
          connection: "한 스터디에서 통한 '먼저 물어보고 고친다'는 방식을 학회 전체 온보딩으로 확장했다",
          temporalNote: null,
        },
        {
          fromExperience: "전국 대학생 데이터 분석 공모전",
          toExperience: "서울 심야 이동 인터랙티브 데이터 시각화",
          relationType: "확장",
          connection: "공모전에서 다룬 데이터를 전달 방식의 문제로 다시 붙잡아 개인 작업으로 이어갔다",
          temporalNote: "공모전 종료 4개월 뒤 착수",
        },
      ],
      structure: {
        start: "따라가기도 벅찼던 학회 정회원 시절",
        development: "스터디장으로 커리큘럼을 직접 설계하며 이탈 지점을 관찰",
        evidence: "이탈률 40%→12%, 지원자 24명→41명, 초기 이탈 9명→3명",
        growth: "학회장으로 온보딩 전체를 근거 기반으로 개편",
        destination: "관찰을 근거로 방식을 바꾸는 사람으로 자리 잡음",
      },
      usedExperiences: {
        core: ["데이터 분석 학회 DataWave", "서울 심야 이동 인터랙티브 데이터 시각화"],
        supporting: ["미국 워싱턴대학교 교환학생"],
      },
      keyQuotes: [
        {
          careerTitle: "데이터 분석 학회 DataWave",
          quote: "커리큘럼을 8주로 설계하고 매주 실습 문제를 직접 만들었습니다.",
        },
        {
          careerTitle: "서울 심야 이동 인터랙티브 데이터 시각화",
          quote:
            "초기에는 모든 노선을 한 번에 보여줬는데 아무것도 읽히지 않아, 시간대 슬라이더를 넣어 한 번에 한 시점만 보이도록 바꿨습니다.",
        },
      ],
    },
  ],
  improvementGuide: {
    overallDirection: {
      currentProfileSummary:
        "문제 해결은 원인-조치-검증이 모두 갖춰진 high 근거가 3건으로 충분합니다. 반면 자기주도성은 학회 안에서의 사례에 몰려 있어 맥락이 좁습니다.",
      shortTerm:
        "이미 있는 사례에 '그 뒤에 무엇이 달라졌는지'를 한 줄씩 붙여 문제 해결 근거를 결과까지 연결하세요.",
      midTerm:
        "데이터 분석 직무 지원에 맞춰, 학회 밖(외부 커뮤니티·공모전)에서 스스로 시작한 사례를 1건 확보하세요.",
      priorityKeyword: "자기주도성",
      priorityReason: "근거의 수는 충분하지만 대부분 한 조직 안에서 나와 일반화가 약합니다.",
    },
    informationEnhancement: [
      {
        target: "자연어처리 연구실 학부 연구생",
        missing: "개정된 가이드라인이 이후 어떻게 쓰였는지",
        howToAdd: "'개정 이후 신규 레이블러 N명이 이 문서로 온보딩했다' 식으로 한 줄 추가",
        reason: "문제 해결 기준 #3(정량 검증)을 결과 활용까지 확장",
        priority: "높음",
      },
      {
        target: "전국 대학생 데이터 분석 공모전 우수상",
        missing: "분석에 사용한 데이터의 규모와 기간",
        howToAdd: "결합한 두 데이터의 기간과 건수를 수상 내용 옆에 명시",
        reason: "분석의 신뢰 범위를 판단할 근거가 없음",
        priority: "중간",
      },
      {
        target: "영어 — 논문 독해와 실무 소통",
        missing: "학습의 결과물",
        howToAdd: "요약 노트를 공개 저장소로 정리하거나, 번역·공유한 문서를 링크로 남기기",
        reason: "자기주도성 #4(완성된 산출물) 근거가 없어 참고용으로만 반영됨",
        priority: "중간",
      },
    ],
    experienceExpansion: [
      {
        gapDescription: "학회 밖에서 스스로 시작한 사례 부족",
        suggestedExperienceType: "외부 커뮤니티 활동 / 오픈 프로젝트",
        whyHelpful: "주도성이 특정 조직의 역할 때문이 아니라 성향임을 보여줌",
        examples: ["가짜연구소 스터디 개설", "공공데이터 분석 결과 공개 기고"],
        priority: "높음",
      },
    ],
    keywordSpecificRecommendations: [
      {
        keyword: "문제 해결",
        recommendations: [
          {
            type: "보완",
            title: "각 사례에 '이후 변화' 한 줄 추가",
            expectedEffect: "원인-조치-검증에서 활용까지 이어지는 완결형 근거 확보",
          },
          {
            type: "확장",
            title: "공공데이터 공모전 재참가",
            expectedEffect: "같은 도메인에서 두 번째 정량 성과 확보",
          },
        ],
      },
      {
        keyword: "자기주도성",
        recommendations: [
          {
            type: "확장",
            title: "교외 스터디 개설 또는 운영 참여",
            expectedEffect: "조직 밖에서도 먼저 시작하는 사람이라는 근거 확보",
          },
        ],
      },
    ],
  },
};

// ─── Bookmarks ──────────────────────────────────────────────

export const mockBookmarks: BookmarkedSnapshot[] = [
  { ...mockIndividualAnalysisList[0], bookmarkedAt: "2026-06-08T15:00:00Z" },
  { ...mockIndividualAnalysisList[3], bookmarkedAt: "2026-06-02T12:30:00Z" },
  { ...mockComprehensiveList[0], bookmarkedAt: "2026-06-07T13:00:00Z" },
  { ...mockKeywordList[1], bookmarkedAt: "2026-06-01T16:00:00Z" },
];

// ─── History ────────────────────────────────────────────────

export const mockHistory: AnalysisSnapshot[] = [
  ...mockIndividualAnalysisList.filter((s) => s.status === "completed"),
  ...mockComprehensiveList.filter((s) => s.status === "completed"),
  ...mockKeywordList,
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

// ─── Selectable Experiences (for new analysis) ──────────────
// 시드 경험 8건과 id·제목·유형이 1:1로 대응해야 한다(lib/demo/seed.test.ts).

export const mockSelectableExperiences = [
  { id: "exp-demo-career", title: "자연어처리 연구실 학부 연구생", type: "career", importance: 5 as const, isComplete: true },
  { id: "exp-demo-extracurricular", title: "네이버 부스트캠프 AI Tech 6기", type: "extracurricular", importance: 4 as const, isComplete: true },
  { id: "exp-demo-club", title: "데이터 분석 학회 DataWave", type: "club", importance: 4 as const, isComplete: true },
  { id: "exp-demo-award", title: "전국 대학생 데이터 분석 공모전 우수상", type: "award", importance: 5 as const, isComplete: true },
  { id: "exp-demo-creative", title: "서울 심야 이동 인터랙티브 데이터 시각화", type: "creative-work", importance: 3 as const, isComplete: true },
  { id: "exp-demo-language", title: "영어 — 논문 독해와 실무 소통", type: "language", importance: 3 as const, isComplete: true },
  { id: "exp-demo-overseas", title: "미국 워싱턴대학교 교환학생", type: "overseas", importance: 4 as const, isComplete: true },
  { id: "exp-demo-certification", title: "SQL 개발자 (SQLD)", type: "certification", importance: 2 as const, isComplete: true },
];
