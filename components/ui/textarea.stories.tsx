import type { Meta, StoryObj } from "@storybook/nextjs";

import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    disabled: { control: "boolean" },
  },
  args: {
    placeholder: "내용을 입력하세요",
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

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    label: "자기소개",
    placeholder: "간단히 자신을 소개해 주세요",
  },
};

export const WithHint: Story = {
  args: {
    label: "자기소개",
    hint: "500자 이내로 작성해 주세요",
    placeholder: "간단히 자신을 소개해 주세요",
  },
};

export const WithError: Story = {
  args: {
    label: "자기소개",
    error: "필수 항목입니다",
  },
};

export const WithDefaultValue: Story = {
  args: {
    label: "자기소개",
    defaultValue:
      "안녕하세요! 저는 프론트엔드 개발자입니다.\n\nReact와 TypeScript를 주로 사용하며, 사용자 경험을 개선하는 일에 관심이 많습니다.",
  },
};

export const Disabled: Story = {
  args: {
    label: "비활성화 필드",
    disabled: true,
    defaultValue: "편집할 수 없습니다",
  },
};
