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
      name: "김서윤",
      headline: "AI·ML과 데이터 분석을 두 축으로 성장하는 예비 개발자",
      strengthTags: ["문제 해결", "데이터 기반 의사결정", "자기주도성"],
    },
  },
};

export const NoStrengths: Story = {
  args: {
    profile: {
      name: "김서윤",
      headline: "AI·ML과 데이터 분석을 두 축으로 성장하는 예비 개발자",
      strengthTags: [],
    },
  },
};

export const WithTagline: Story = {
  args: {
    profile: {
      name: "김서윤",
      headline: "AI·ML과 데이터 분석을 두 축으로 성장하는 예비 개발자",
      strengthTags: ["문제 해결", "실험 재현성"],
    },
    tagline: "데이터 안에서 사람의 이야기를 찾는 개발자",
  },
};

export const WithTaglineAndFacts: Story = {
  args: {
    profile: {
      name: "김서윤",
      headline: "AI·ML과 데이터 분석을 두 축으로 성장하는 예비 개발자",
      strengthTags: ["문제 해결", "실험 재현성"],
    },
    tagline: "데이터 안에서 사람의 이야기를 찾는 개발자",
    profileFacts: [
      { label: "학교", value: "한양대학교 컴퓨터소프트웨어학부" },
      { label: "관심사", value: "자연어처리 · 데이터 시각화 · 투자 알고리즘" },
      { label: "GitHub", value: "github.com/seoyk" },
    ],
  },
};
