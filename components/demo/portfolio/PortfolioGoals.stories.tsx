import type { Meta, StoryObj } from "@storybook/react";

import { DEMO_PORTFOLIO_CONTENT } from "@/lib/demo/content";

import { PortfolioGoals } from "./PortfolioGoals";

const meta: Meta<typeof PortfolioGoals> = {
  title: "demo/portfolio/PortfolioGoals",
  component: PortfolioGoals,
};
export default meta;
type Story = StoryObj<typeof PortfolioGoals>;

export const Default: Story = {
  args: {
    goals: DEMO_PORTFOLIO_CONTENT.goals,
    growthJourney: DEMO_PORTFOLIO_CONTENT.growthJourney,
  },
};

export const SingleGoal: Story = {
  args: {
    goals: [DEMO_PORTFOLIO_CONTENT.goals[0]],
    growthJourney: "",
  },
};
