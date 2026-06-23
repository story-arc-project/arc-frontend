// 데모 e-포트폴리오 콘텐츠 — 자기소개·가치관·목표·성장 여정 정적 리터럴.
// types/portfolio.ts 나 다른 demo 모듈에 의존하지 않는 독립 파일이다.

export interface DemoValueCard {
  icon: string;
  title: string;
  description: string;
}

export interface DemoGoal {
  timeframe: string;
  text: string;
}

export interface DemoExperienceGroup {
  libraryId: string;
  name: string;
  tailwindColorClass: string;
  postIds: string[];
}

export interface DemoProfileFact {
  label: string;
  value: string;
}

export interface DemoAward {
  title: string;
  period: string;
  note: string;
}

export interface DemoAbout {
  tagline: string;
  narrative: string;
  profileFacts: DemoProfileFact[];
  awardsAndActivities: DemoAward[];
}

export interface DemoPortfolioContent {
  about: DemoAbout;
  values: DemoValueCard[];
  experienceGroups: DemoExperienceGroup[];
  goals: DemoGoal[];
  growthJourney: string;
}

export const DEMO_PORTFOLIO_CONTENT: DemoPortfolioContent = {
  about: {
    tagline: "데이터 안에서 사람의 이야기를 찾는 개발자",
    narrative:
      "코드를 짤 때 가장 먼저 묻는 질문은 \"이 숫자 뒤에 어떤 사람이 있을까?\"예요. AI·ML 프로젝트부터 Android 앱, 이커머스 분석까지 — 기술의 종류보다 그 기술이 실제 문제를 얼마나 정직하게 다루는지에 관심을 가져왔어요. 지금은 데이터 기반으로 의사결정을 돕는 ML 엔지니어나 데이터 분석가로 커리어를 시작하고 싶어요.",
    profileFacts: [
      { label: "학교", value: "한양대학교 컴퓨터소프트웨어학부" },
      { label: "관심사", value: "자연어처리 · 데이터 시각화 · 투자 알고리즘" },
      { label: "GitHub", value: "github.com/seoyk" },
    ],
    awardsAndActivities: [
      {
        title: "네이버 부스트캠프 AI Tech 6기 수료",
        period: "2025.07 – 2025.11",
        note: "Object Detection mAP 0.68",
      },
      {
        title: "SQLD 취득",
        period: "2025.04",
        note: "한국데이터산업진흥원",
      },
    ],
  },
  values: [
    {
      icon: "🔍",
      title: "정직한 질문",
      description:
        "좋아 보이는 결과보다 \"왜 이게 맞는가?\"를 먼저 묻는 습관이에요. NLP 연구실에서 애매한 경계 사례를 무시하지 않고 예시로 정면 돌파한 경험이 이 가치의 기원이에요.",
    },
    {
      icon: "🔁",
      title: "재현 가능한 실험",
      description:
        "어제의 나도 오늘의 팀원도 같은 결과를 볼 수 있어야 해요. random seed 고정, 설정 파일, 결정론적 추론을 모든 프로젝트에서 지키려 했어요.",
    },
    {
      icon: "🧩",
      title: "문제 먼저",
      description:
        "기술은 수단이에요. 주가 예측에서 LLM을 고른 건 트렌드 때문이 아니라, 비정형 뉴스를 정량 지표로 바꾸는 데 가장 적합한 도구여서였어요.",
    },
  ],
  experienceGroups: [
    {
      libraryId: "demo-lib-ai",
      name: "AI/ML 프로젝트",
      tailwindColorClass: "bg-violet-500",
      postIds: ["exp-v2-1", "exp-v2-4", "exp-v2-5"],
    },
    {
      libraryId: "demo-lib-dev",
      name: "개발 & 교육",
      tailwindColorClass: "bg-blue-500",
      postIds: ["exp-v2-2", "exp-v2-3"],
    },
  ],
  goals: [
    {
      timeframe: "단기 · 졸업 후 1~2년",
      text: "ML 엔지니어 또는 데이터 분석가로 입사해, 실험 설계부터 결과 해석까지 end-to-end로 담당하는 경험을 쌓고 싶어요.",
    },
    {
      timeframe: "장기 · 3~5년",
      text: "언어와 숫자를 모두 다루는 기술을 바탕으로, 사용자 행동 데이터에서 사람들의 필요를 발견하는 프로덕트 팀에서 일하고 싶어요.",
    },
  ],
  growthJourney:
    "처음 코딩을 시작했을 때는 \"동작하는 코드\"를 만드는 것이 목표였어요. 버스 앱 팀 프로젝트에서 API 호출 횟수를 줄이는 방법을 고민하면서, 동작보다 설계가 더 오래 남는다는 걸 처음 느꼈어요. 부스트캠프와 NLP 연구실을 거치면서는 측정할 수 없는 결과는 결과가 아님을 배웠고, 이커머스 분석 프로젝트에서는 데이터 뒤에 사람의 행동이 있다는 사실이 분석을 흥미롭게 만든다는 걸 발견했어요. 지금의 저는, 좋은 질문을 만드는 사람이 좋은 코드를 만든다고 믿어요.",
};
