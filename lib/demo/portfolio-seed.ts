// e-포트폴리오 데모 시드. 기존 경험 시드 + 큐레이션된 프로필로 단일 포트폴리오를 조립한다.
// 실서비스 API 표면이 아니라 데모 전용이다.

import type { Portfolio, PortfolioProfile } from "@/types/portfolio";
import { buildPortfolio } from "@/lib/portfolio/build-portfolio";
import { seedExperiences } from "./seed";

export const DEMO_PORTFOLIO_ID = "demo-portfolio-1";

// 강점/headline 은 데모 분석 결과(소프트스킬)와 결을 맞춘 정적 큐레이션 값이다.
export const DEMO_PORTFOLIO_PROFILE: PortfolioProfile = {
  name: "김서윤",
  headline: "AI·ML과 데이터 분석을 두 축으로 성장하는 예비 개발자",
  strengthTags: ["문제 해결", "데이터 기반 의사결정", "자기주도성", "실험 재현성"],
};

export const seedPortfolio: Portfolio = buildPortfolio(
  DEMO_PORTFOLIO_ID,
  seedExperiences,
  DEMO_PORTFOLIO_PROFILE,
);

export { DEMO_PORTFOLIO_CONTENT } from "./content";
