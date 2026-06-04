import type { Meta, StoryObj } from "@storybook/nextjs";

import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    disabled: { control: "boolean" },
  },
  args: {
    placeholder: "입력하세요",
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

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    label: "이름",
    placeholder: "홍길동",
  },
};

export const WithHint: Story = {
  args: {
    label: "이메일",
    hint: "업무용 이메일을 입력해 주세요",
    placeholder: "email@example.com",
  },
};

export const WithError: Story = {
  args: {
    label: "이메일",
    error: "유효한 이메일 주소를 입력해 주세요",
    placeholder: "email@example.com",
    defaultValue: "잘못된이메일",
  },
};

export const Disabled: Story = {
  args: {
    label: "비활성화 필드",
    disabled: true,
    defaultValue: "편집 불가",
  },
};
