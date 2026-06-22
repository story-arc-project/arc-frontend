import type { Meta, StoryObj } from "@storybook/react";

import { PortfolioPostCard } from "./PortfolioPostCard";

const meta: Meta<typeof PortfolioPostCard> = {
  title: "demo/portfolio/PortfolioPostCard",
  component: PortfolioPostCard,
};
export default meta;
type Story = StoryObj<typeof PortfolioPostCard>;

export const Full: Story = {
  args: {
    href: "#",
    post: {
      id: "exp-1",
      title: "LLM 활용 뉴스 감성 분석 기반 하이브리드 주가 예측 프로젝트",
      period: "2026.02 – 2026.05",
      category: "개인 프로젝트",
      summary: "Gemma-2 LLM으로 비정형 뉴스를 정량 투자 지표로 변환한 프로젝트예요.",
      contribution: "전 과정 독립 수행",
      achievement: "백테스팅 시각화 완성",
      keywords: ["LLM", "NLP", "백테스팅", "AI트레이딩"],
    },
  },
};

export const Minimal: Story = {
  args: {
    href: "#",
    post: {
      id: "exp-2",
      title: "제목만 있는 경험",
      period: "",
      category: "경험",
      summary: "",
      contribution: "",
      achievement: "",
      keywords: [],
    },
  },
};
