import type { Meta, StoryObj } from "@storybook/nextjs";

import AnalysisSNB from "./AnalysisSNB";

const meta: Meta<typeof AnalysisSNB> = {
  title: "Features/Analysis/AnalysisSNB",
  component: AnalysisSNB,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;

type Story = StoryObj<typeof AnalysisSNB>;

export const HomeActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/analysis",
      },
    },
  },
};

export const IndividualActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/analysis/individual",
      },
    },
  },
};

export const ComprehensiveActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/analysis/comprehensive",
      },
    },
  },
};

export const KeywordActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/analysis/keyword",
      },
    },
  },
};

export const BookmarksActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/analysis/bookmarks",
      },
    },
  },
};
