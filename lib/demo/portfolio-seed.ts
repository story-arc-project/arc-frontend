// e-포트폴리오 데모에서 사용하는 ID와 큐레이션된 프로필.
// 실서비스 API 표면이 아니라 데모 전용이다.

import type { PortfolioProfile } from "@/types/portfolio";

export const DEMO_PORTFOLIO_ID = "demo-portfolio-1";

// 강점/headline 은 데모 분석 결과(소프트스킬)와 결을 맞춘 정적 큐레이션 값이다.
export const DEMO_PORTFOLIO_PROFILE: PortfolioProfile = {
  name: "김서윤",
  headline: "기준을 세우고 숫자를 의심하는 데이터 분석 지망생",
  strengthTags: ["문제 해결", "데이터 품질", "자기주도성", "실험 재현성"],
};

export { DEMO_PORTFOLIO_CONTENT } from "./content";
