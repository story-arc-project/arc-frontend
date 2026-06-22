import type { Meta, StoryObj } from "@storybook/react";

import { PortfolioPostBody } from "./PortfolioPostBody";

const meta: Meta<typeof PortfolioPostBody> = {
  title: "demo/portfolio/PortfolioPostBody",
  component: PortfolioPostBody,
};
export default meta;
type Story = StoryObj<typeof PortfolioPostBody>;

export const Full: Story = {
  args: {
    post: {
      id: "exp-1",
      title: "LLM 활용 뉴스 감성 분석 기반 하이브리드 주가 예측 프로젝트",
      period: "2026.02 – 2026.05",
      category: "개인 프로젝트",
      summary: "Gemma-2 LLM으로 비정형 뉴스를 정량 투자 지표로 변환했어요.",
      contribution: "기획·데이터 수집·모델 통합·백테스팅까지 전 과정 독립 수행",
      achievement: "전략 수익률 vs 시장 수익률 백테스팅 구현 및 시각화 완성",
      keywords: ["LLM", "NLP", "백테스팅"],
    },
  },
};

export const PartialFields: Story = {
  args: {
    post: {
      id: "exp-2",
      title: "성과 항목이 비어있는 경험",
      period: "",
      category: "경험",
      summary: "요약만 있는 경우 다른 섹션은 숨겨져야 한다.",
      contribution: "",
      achievement: "",
      keywords: [],
    },
  },
};
