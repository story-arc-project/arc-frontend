import type { Meta, StoryObj } from "@storybook/react";

import { PortfolioHero } from "./PortfolioHero";

const meta: Meta<typeof PortfolioHero> = {
  title: "demo/portfolio/PortfolioHero",
  component: PortfolioHero,
};
export default meta;
type Story = StoryObj<typeof PortfolioHero>;

export const Default: Story = {
  args: {
    profile: {
      name: "데모 사용자",
      headline: "AI/ML과 데이터 분석으로 실세계 문제를 해결하는 예비 개발자",
      strengthTags: ["문제 해결", "데이터 기반 의사결정", "자기주도성"],
    },
  },
};

export const NoStrengths: Story = {
  args: {
    profile: { name: "데모 사용자", headline: "한 줄 소개만 있는 경우", strengthTags: [] },
  },
};
