import type { Meta, StoryObj } from "@storybook/react";

import type { PostGroup } from "@/lib/demo/group-posts";

import { PortfolioExperienceGroups } from "./PortfolioExperienceGroups";

const meta: Meta<typeof PortfolioExperienceGroups> = {
  title: "demo/portfolio/PortfolioExperienceGroups",
  component: PortfolioExperienceGroups,
};
export default meta;
type Story = StoryObj<typeof PortfolioExperienceGroups>;

const fakePost = (id: string, title: string) => ({
  id,
  title,
  period: "2025.01 – 2025.06",
  category: "개인 프로젝트",
  summary: "요약 텍스트예요.",
  contribution: "",
  achievement: "",
  keywords: ["Python", "ML"],
});

const sampleGroups: PostGroup[] = [
  {
    group: {
      libraryId: "lib-ai",
      name: "AI/ML 프로젝트",
      tailwindColorClass: "bg-violet-500",
      postIds: ["p1", "p2"],
    },
    posts: [fakePost("p1", "LLM 주가 예측"), fakePost("p2", "이커머스 분석")],
  },
  {
    group: {
      libraryId: "lib-dev",
      name: "개발 & 교육",
      tailwindColorClass: "bg-blue-500",
      postIds: ["p3"],
    },
    posts: [fakePost("p3", "버스 앱")],
  },
];

export const Default: Story = {
  args: {
    groups: sampleGroups,
    portfolioId: "demo-portfolio-1",
  },
};

export const EmptyGroup: Story = {
  args: {
    groups: [
      {
        group: {
          libraryId: "lib-empty",
          name: "빈 그룹",
          tailwindColorClass: "bg-violet-500",
          postIds: [],
        },
        posts: [],
      },
    ],
    portfolioId: "demo-portfolio-1",
  },
};

export const SingleGroup: Story = {
  args: {
    groups: [
      {
        group: {
          libraryId: "lib-single",
          name: "하나의 그룹",
          tailwindColorClass: "bg-blue-500",
          postIds: ["p1"],
        },
        posts: [fakePost("p1", "단일 경험")],
      },
    ],
    portfolioId: "demo-portfolio-1",
  },
};
