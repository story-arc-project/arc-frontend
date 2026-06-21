// e-포트폴리오 데모 전용 뷰 모델. 실서비스 API 표면이 아니다.

export interface PortfolioProfile {
  name: string;
  /** 한 줄 소개 (히어로) */
  headline: string;
  /** 강점 태그 (히어로 칩) */
  strengthTags: string[];
}

export interface PortfolioPost {
  /** 원본 experience id 재사용 */
  id: string;
  title: string;
  /** "2026.02 – 2026.05" 형식, 없으면 "" */
  period: string;
  /** 경험 타입 한글 라벨 (예: "개인 프로젝트") */
  category: string;
  /** 한 줄 요약 */
  summary: string;
  /** 내 역할/기여도 */
  contribution: string;
  /** 핵심 성과 */
  achievement: string;
  keywords: string[];
}

export interface Portfolio {
  id: string;
  profile: PortfolioProfile;
  posts: PortfolioPost[];
}
