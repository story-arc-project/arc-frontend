import type { Meta, StoryObj } from "@storybook/react";

import { PortfolioValues } from "./PortfolioValues";

const meta: Meta<typeof PortfolioValues> = {
  title: "demo/portfolio/PortfolioValues",
  component: PortfolioValues,
};
export default meta;
type Story = StoryObj<typeof PortfolioValues>;

export const Default: Story = {
  args: {
    values: [
      {
        icon: "🔍",
        title: "정직한 질문",
        description: "좋아 보이는 결과보다 \"왜 이게 맞는가?\"를 먼저 묻는 습관이에요.",
      },
      {
        icon: "🔁",
        title: "재현 가능한 실험",
        description: "어제의 나도 오늘의 팀원도 같은 결과를 볼 수 있어야 해요.",
      },
      {
        icon: "🧩",
        title: "문제 먼저",
        description: "기술은 수단이에요.",
      },
    ],
  },
};

export const SingleValue: Story = {
  args: {
    values: [
      {
        icon: "🔍",
        title: "정직한 질문",
        description: "하나의 가치관만 있는 경우.",
      },
    ],
  },
};
