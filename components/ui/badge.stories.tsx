import type { Meta, StoryObj } from "@storybook/nextjs";

import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["default", "brand", "success", "warning", "error", "outline"],
    },
  },
  args: {
    children: "배지",
    variant: "default",
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { variant: "default" },
};

export const Brand: Story = {
  args: { variant: "brand" },
};

export const Success: Story = {
  args: { variant: "success", children: "완료" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "경고" },
};

export const Error: Story = {
  args: { variant: "error", children: "오류" },
};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["default", "brand", "success", "warning", "error", "outline"] as const).map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};
