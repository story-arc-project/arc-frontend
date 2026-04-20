import type { KeywordAnalysisResult } from "@/types/analysis";

export const demoKeywordResult: KeywordAnalysisResult = {
  id: "kw-1",
  title: "'데이터 분석 · 브랜드 기획' 키워드 분석",
  analyzedAt: "2026-04-14T14:00:00Z",
  isBookmarked: false,
  overallConfidence: "partial",
  selectedKeywords: ["데이터 분석", "브랜드 기획"],
  keywordDefinitions: [
    {
      keywordId: "kd-1",
      label: "데이터 분석",
      category: "skill",
      redefinition:
        "마케팅 의사결정에 쓸 수 있도록 데이터를 수집·가공·해석해 근거 있는 제안을 만드는 역량",
      synonyms: ["데이터 드리븐", "정량 분석", "퍼포먼스 분석"],
      fitCriteria: [
        { id: "fc-1", description: "실제 분석 도구(GA4·SQL·Looker 등)로 리포트를 만든 경험" },
        { id: "fc-2", description: "정량 지표로 개선/저하를 진단한 사례" },
        { id: "fc-3", description: "분석 결과를 협업 파트너에게 설명해 의사결정에 반영" },
        { id: "fc-4", description: "원천 데이터(쿼리/이벤트 설계 등)를 직접 다뤄본 경험" },
      ],
    },
    {
      keywordId: "kd-2",
      label: "브랜드 기획",
      category: "skill",
      redefinition:
        "타겟 인사이트에서 브랜드 컨셉·메시지·IMC 플랜으로 이어지는 전략적 기획을 수행하는 역량",
      synonyms: ["브랜드 전략", "컨셉 기획", "IMC"],
      fitCriteria: [
        { id: "fc-5", description: "소비자 조사(서베이·FGI 등) 설계·집행 경험" },
        { id: "fc-6", description: "브랜드 컨셉·메시지를 실제로 제안한 사례" },
        { id: "fc-7", description: "IMC/채널 플랜 또는 콘텐츠 캘린더 실행 경험" },
        { id: "fc-8", description: "브랜드 운영을 장기적으로 끌고 간 증거" },
      ],
    },
  ],
  selectionCriteria:
    "단순 참여 언급이 아닌 '본인이 직접 분석/기획을 수행한 행동'과 '정량 또는 외부 검증 가능한 결과'가 동시에 존재하는 경험에 우선순위를 뒀습니다. 공모전·인턴·자격증·블로그처럼 증거 강도가 다른 경험들을 키워드별로 분리해 평가했습니다.",
  coverage: [
    { keywordId: "kd-1", label: "데이터 분석", matchedCount: 4, totalCount: 9 },
    { keywordId: "kd-2", label: "브랜드 기획", matchedCount: 3, totalCount: 9 },
  ],
  matchedExperiences: [
    {
      keywordId: "kd-1",
      experienceId: "exp-1",
      title: "오늘의 집 마케팅 인턴",
      fitScore: 88,
      evidence: {
        quote: "GA4 데이터로 세그먼트별 CAC를 주간으로 리포트",
        experienceTitle: "오늘의 집 마케팅 인턴",
      },
      matchedCriteriaIds: ["fc-1", "fc-2", "fc-3"],
    },
    {
      keywordId: "kd-1",
      experienceId: "exp-4",
      title: "부스트캠프 마케팅 데이터 분석 트랙",
      fitScore: 80,
      evidence: {
        quote: "커머스 가상 데이터셋(5만 행)으로 코호트 리텐션 분석 대시보드 구축",
        experienceTitle: "부스트캠프",
      },
      matchedCriteriaIds: ["fc-1", "fc-4"],
    },
    {
      keywordId: "kd-1",
      experienceId: "exp-6",
      title: "Google Analytics 개인 자격증 (GAIQ)",
      fitScore: 58,
      evidence: {
        quote: "GA4 이벤트 구조를 조직 관점에서 어떻게 설계해야 하는지를 정리",
        experienceTitle: "GAIQ",
      },
      matchedCriteriaIds: ["fc-4"],
    },
    {
      keywordId: "kd-1",
      experienceId: "exp-5",
      title: "브랜드 블로그 'minji.log'",
      fitScore: 42,
      evidence: {
        quote: "네이버·구글 검색 키워드를 매주 점검",
        experienceTitle: "브랜드 블로그",
      },
      matchedCriteriaIds: ["fc-2"],
    },
    {
      keywordId: "kd-2",
      experienceId: "exp-3",
      title: "유한킴벌리 공모전 2위",
      fitScore: 82,
      evidence: {
        quote: "서베이(N=412) + FGI(n=8)로 도출한 인사이트를 기반으로 캠페인 컨셉 제안",
        experienceTitle: "유한킴벌리 공모전",
      },
      matchedCriteriaIds: ["fc-5", "fc-6", "fc-7"],
    },
    {
      keywordId: "kd-2",
      experienceId: "exp-5",
      title: "브랜드 블로그 'minji.log'",
      fitScore: 64,
      evidence: {
        quote: "월간 에디토리얼 캘린더 운영",
        experienceTitle: "브랜드 블로그",
      },
      matchedCriteriaIds: ["fc-7", "fc-8"],
    },
    {
      keywordId: "kd-2",
      experienceId: "exp-7",
      title: "종로구 소상공인 SNS 마케팅 봉사",
      fitScore: 55,
      evidence: {
        quote: "매장별 포지셔닝 진단 → 주 3회 콘텐츠 제작",
        experienceTitle: "소상공인 SNS 봉사",
      },
      matchedCriteriaIds: ["fc-6", "fc-7"],
    },
  ],
  storylines: [
    {
      id: "ksl-1",
      start: "부스트캠프에서 SQL·GA4·Looker를 실전 과제로 배움",
      development:
        "GAIQ로 지식을 공식화하고, 오늘의 집 인턴에서 GA4 기반 A/B 실험을 주도",
      evidence: "GA4 세그먼트별 CAC 리포팅 · 코호트 리텐션 대시보드 · A/B 실험 2주 루틴",
      growth:
        "공모전의 브랜드 전략 기획과 인턴의 퍼포먼스 실행을 한 포지션에서 쓸 수 있도록 블로그 케이스 스터디로 연결",
      arrival: "브랜드를 숫자로 운영할 수 있는 주니어 마케터",
      coreExperienceIds: ["exp-1", "exp-4", "exp-3"],
      supportingExperienceIds: ["exp-6", "exp-5"],
    },
  ],
  fitEvaluations: [
    {
      keywordId: "kd-1",
      label: "데이터 분석",
      totalScore: 78,
      axes: { specificity: 20, actionClarity: 20, impactStrength: 19, consistency: 19 },
      strongEvidences: [
        { quote: "CTR 2.1% → 3.4%, CAC -18%", experienceTitle: "오늘의 집 마케팅 인턴" },
        { quote: "코호트 리텐션 분석 대시보드 구축", experienceTitle: "부스트캠프" },
      ],
      weakEvidences: [
        { quote: "SQL 기초", experienceTitle: "오늘의 집 마케팅 인턴" },
      ],
      missingEvidences: ["BigQuery/데이터 웨어하우스 실전 경험", "자체 대시보드 퍼블릭 공개"],
    },
    {
      keywordId: "kd-2",
      label: "브랜드 기획",
      totalScore: 62,
      axes: { specificity: 17, actionClarity: 15, impactStrength: 16, consistency: 14 },
      strongEvidences: [
        { quote: "'매일이 다르니까' 캠페인 컨셉을 제안", experienceTitle: "유한킴벌리 공모전" },
      ],
      weakEvidences: [
        { quote: "월간 에디토리얼 캘린더 운영", experienceTitle: "브랜드 블로그" },
      ],
      missingEvidences: [
        "브랜드를 장기간(6개월 이상) 실전 운영한 단독 사례",
        "IMC 플랜이 실제 집행 단계까지 진행된 증거",
      ],
    },
  ],
  improvementGuides: [
    {
      reason: "데이터 분석 축에서 원천 데이터 직접 다룬 증거가 부족합니다.",
      suggestion: "BigQuery/SQL 실전 프로젝트 1건을 깃허브로 공개하세요.",
      targetField: "사용한 스킬",
    },
    {
      reason: "브랜드 기획 축은 공모전 단일 사례에 의존합니다.",
      suggestion: "블로그를 브랜드 운영 케이스로 리포지셔닝해 장기 증거를 만드세요.",
    },
  ],
  commonRecommendations: [
    {
      id: "krec-1",
      activity: "월간 '브랜드×데이터' 리포트 뉴스레터 발행",
      reason: "두 키워드 모두를 주기적으로 증명할 수 있는 가장 저비용 루트입니다.",
      evidence: { quote: "월간 에디토리얼 캘린더 운영", experienceTitle: "브랜드 블로그" },
      expectedEffect: "두 키워드 부합도 동시 상승",
      type: "expand",
    },
  ],
  keywordRecommendations: [
    {
      id: "krec-2",
      activity: "BigQuery 기반 공공 데이터 분석 프로젝트",
      reason: "데이터 분석 키워드에서 '원천 데이터 직접 다룸' 기준을 충족시키기 위함입니다.",
      evidence: { quote: "SQL 기초", experienceTitle: "오늘의 집 마케팅 인턴" },
      expectedEffect: "데이터 분석 키워드 부합도 상승",
      type: "expand",
    },
    {
      id: "krec-3",
      activity: "개인 브랜드 블로그 리포지셔닝 (콘텐츠 브랜드화)",
      reason: "브랜드 기획 키워드의 '장기 운영 증거' 축을 강화합니다.",
      evidence: { quote: "누적 방문 82,400회", experienceTitle: "브랜드 블로그" },
      expectedEffect: "브랜드 기획 키워드 부합도 상승",
      type: "supplement",
    },
  ],
};
