import type { Meta, StoryObj } from "@storybook/nextjs";

import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["default", "bordered", "elevated", "filled"],
    },
    padding: {
      control: "inline-radio",
      options: ["none", "sm", "md", "lg"],
    },
  },
  args: {
    variant: "default",
    padding: "md",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>카드 제목</CardTitle>
        <CardDescription>카드에 대한 간략한 설명입니다.</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button size="sm">확인</Button>
      </CardFooter>
    </Card>
  ),
};

export const Bordered: Story = {
  args: { variant: "bordered" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Bordered 카드</CardTitle>
        <CardDescription>강조된 테두리가 있는 카드입니다.</CardDescription>
      </CardHeader>
    </Card>
  ),
};

export const Elevated: Story = {
  args: { variant: "elevated" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Elevated 카드</CardTitle>
        <CardDescription>그림자로 높이를 표현한 카드입니다.</CardDescription>
      </CardHeader>
    </Card>
  ),
};

export const Filled: Story = {
  args: { variant: "filled" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Filled 카드</CardTitle>
        <CardDescription>배경색으로 구분되는 카드입니다.</CardDescription>
      </CardHeader>
    </Card>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["default", "bordered", "elevated", "filled"] as const).map((variant) => (
        <Card key={variant} variant={variant} padding="md">
          <CardTitle>{variant}</CardTitle>
          <CardDescription>이 카드는 {variant} 스타일입니다.</CardDescription>
        </Card>
      ))}
    </div>
  ),
};
