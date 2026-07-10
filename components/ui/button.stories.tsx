import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";
import Link from "next/link";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "ghost", "destructive"],
    },
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg"],
    },
    fullWidth: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: {
    children: "버튼",
    variant: "primary",
    size: "md",
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Destructive: Story = {
  args: { variant: "destructive" },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

/**
 * FRT-80 — `asChild`로 Link를 감싸면 버튼 스타일이 자식(`<a>`)에 병합돼
 * 단일 상호작용 요소(`<a>`)로 렌더된다. `<a>` 안에 `<button>`이 중첩되지 않는다.
 */
export const AsChildLink: Story = {
  render: () => (
    <Button asChild variant="secondary" size="sm">
      <Link href="/archive">경험 기록하러 가기</Link>
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "경험 기록하러 가기" });
    expect(link.tagName).toBe("A");
    // 상호작용 요소 중첩 없음
    expect(canvasElement.querySelector("button")).toBeNull();
  },
};
