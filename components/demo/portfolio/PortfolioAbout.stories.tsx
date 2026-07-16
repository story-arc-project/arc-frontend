import type { Meta, StoryObj } from "@storybook/react";

import { PortfolioAbout } from "./PortfolioAbout";

const meta: Meta<typeof PortfolioAbout> = {
  title: "demo/portfolio/PortfolioAbout",
  component: PortfolioAbout,
};
export default meta;
type Story = StoryObj<typeof PortfolioAbout>;

export const Default: Story = {
  args: {
    about: {
      tagline: "데이터 안에서 사람의 이야기를 찾는 개발자",
      narrative:
        "코드를 짤 때 가장 먼저 묻는 질문은 \"이 숫자 뒤에 어떤 사람이 있을까?\"예요.",
      profileFacts: [
        { label: "학교", value: "한양대학교 컴퓨터소프트웨어학부" },
      ],
      awardsAndActivities: [
        {
          title: "네이버 부스트캠프 AI Tech 6기 수료",
          period: "2025.07 – 2025.11",
          note: "Object Detection mAP 0.68",
        },
        {
          title: "SQLD 취득",
          period: "2025.04",
          note: "한국데이터산업진흥원",
        },
      ],
    },
  },
};

export const NoAwards: Story = {
  args: {
    about: {
      tagline: "데이터 안에서 사람의 이야기를 찾는 개발자",
      narrative: "수상 내역이 없는 경우 수상 블록을 렌더하지 않는다.",
      profileFacts: [],
      awardsAndActivities: [],
    },
  },
};
