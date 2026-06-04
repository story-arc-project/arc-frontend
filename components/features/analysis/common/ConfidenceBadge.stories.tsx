import type { Meta, StoryObj } from "@storybook/nextjs";

import type { ConfidenceLevel } from "@/types/analysis";

import ConfidenceBadge from "./ConfidenceBadge";

const meta: Meta<typeof ConfidenceBadge> = {
  title: "Features/Analysis/ConfidenceBadge",
  component: ConfidenceBadge,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    confidence: {
      control: "inline-radio",
      options: ["sufficient", "partial", "insufficient"] satisfies ConfidenceLevel[],
    },
  },
  args: {
    confidence: "sufficient",
  },
};

export default meta;

type Story = StoryObj<typeof ConfidenceBadge>;

export const Sufficient: Story = {
  args: { confidence: "sufficient" },
};

export const Partial: Story = {
  args: { confidence: "partial" },
};

export const Insufficient: Story = {
  args: { confidence: "insufficient" },
};

export const AllLevels: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <ConfidenceBadge confidence="sufficient" />
      <ConfidenceBadge confidence="partial" />
      <ConfidenceBadge confidence="insufficient" />
    </div>
  ),
};
