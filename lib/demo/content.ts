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

// 라이브러리 id → 경험 그룹 색상 클래스. 시드 라이브러리만 매핑하고,
// 사용자가 데모에서 새로 만든 라이브러리는 기본 색을 쓴다.
export const EXPERIENCE_GROUP_STYLES: Record<string, string> = {
  "demo-lib-ai": "bg-violet-500",
  "demo-lib-dev": "bg-blue-500",
};
export const DEFAULT_GROUP_STYLE = "bg-surface-brand";

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
  goals: DemoGoal[];
  growthJourney: string;
}

export const DEMO_PORTFOLIO_CONTENT: DemoPortfolioContent = {
  about: {
    tagline: "숫자를 믿을 수 있게 만드는 사람",
    narrative:
      "분석에서 가장 오래 붙잡는 질문은 \"이 숫자를 믿어도 되나?\"예요. 연구실에서는 레이블링 기준부터 다시 세웠고, 공모전에서는 발표 사흘 전에 제 분석의 오류를 스스로 찾아 결과를 다시 뽑았어요. 데이터를 다루는 일이 결국 기준을 세우고 그 기준을 의심하는 일이라고 생각해요. 지금은 데이터 분석가로 커리어를 시작하고 싶어요.",
    profileFacts: [
      { label: "학교", value: "한양대학교 컴퓨터소프트웨어학부" },
      { label: "관심사", value: "데이터 품질 · 공공데이터 분석 · 데이터 시각화" },
      { label: "GitHub", value: "github.com/seoyk" },
    ],
    awardsAndActivities: [
      {
        title: "전국 대학생 데이터 분석 공모전 우수상",
        period: "2025.11",
        note: "187팀 중 2위 · 한국데이터산업진흥원",
      },
      {
        title: "네이버 부스트캠프 AI Tech 6기 수료",
        period: "2025.07 – 2025.11",
        note: "객체 탐지 대회 21팀 중 4위 (mAP 0.68)",
      },
      {
        title: "데이터 분석 학회 DataWave 학회장",
        period: "2023.03 – 2025.12",
        note: "정회원 → 스터디장 → 학회장",
      },
    ],
  },
  values: [
    {
      icon: "🔍",
      title: "정직한 질문",
      description:
        "좋아 보이는 결과보다 \"왜 이게 맞는가?\"를 먼저 묻는 습관이에요. 연구실에서 판단이 갈리던 경계 사례를 미루지 않고 두 기준으로 각각 재본 경험이 이 가치의 기원이에요.",
    },
    {
      icon: "🔁",
      title: "재현 가능한 실험",
      description:
        "어제의 나도 오늘의 팀원도 같은 결과를 볼 수 있어야 해요. seed 고정과 설정 파일 분리로 반복 실험의 편차를 ±0.004까지 좁혔어요.",
    },
    {
      icon: "👀",
      title: "먼저 물어보기",
      description:
        "추측으로 고치지 않으려고 해요. 학회 모집이 안 될 때 홍보를 늘리는 대신 설문 62건을 먼저 받았고, 문제는 홍보가 아니라 내용이었어요.",
    },
  ],
  goals: [
    {
      timeframe: "단기 · 졸업 후 1~2년",
      text: "데이터 분석가로 입사해, 지표를 정의하는 단계부터 결과를 해석해 전달하는 단계까지 맡아보고 싶어요.",
    },
    {
      timeframe: "장기 · 3~5년",
      text: "분석 결과가 보고서로 끝나지 않고 실제 결정으로 이어지는 구조를 만드는 일까지 해보고 싶어요.",
    },
  ],
  growthJourney:
    "처음 학회에 들어갔을 때는 스터디를 따라가는 것도 벅찼어요. 이듬해 스터디장을 맡으면서 사람들이 어디서 멈추는지 보이기 시작했고, 3주차에 이탈이 몰린다는 걸 확인한 뒤 과제 구조를 바꿨어요. 교환학생 기간에는 결론보다 과정을 먼저 검증하는 태도를 배웠고, 연구실에서는 아예 데이터의 판단 기준을 다시 만들었어요. 공모전에서 제 분석의 오류를 스스로 찾았을 때는 숫자를 의심하는 일이 실력이라는 걸 알았어요. 지금의 저는, 좋은 기준을 세우는 사람이 좋은 결론을 낸다고 믿어요.",
};
