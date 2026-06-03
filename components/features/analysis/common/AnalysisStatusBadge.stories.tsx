import type { Meta, StoryObj } from "@storybook/nextjs";

import AnalysisStatusBadge from "./AnalysisStatusBadge";

const meta: Meta<typeof AnalysisStatusBadge> = {
  title: "Features/Analysis/AnalysisStatusBadge",
  component: AnalysisStatusBadge,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["pending", "completed", "updated"],
    },
  },
  args: {
    status: "pending",
  },
};

export default meta;

type Story = StoryObj<typeof AnalysisStatusBadge>;

export const Pending: Story = {
  args: { status: "pending" },
};

export const Completed: Story = {
  args: { status: "completed" },
};

export const Updated: Story = {
  args: { status: "updated" },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <AnalysisStatusBadge status="pending" />
      <AnalysisStatusBadge status="completed" />
      <AnalysisStatusBadge status="updated" />
    </div>
  ),
};
