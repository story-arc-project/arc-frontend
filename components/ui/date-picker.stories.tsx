import type { Meta, StoryObj } from "@storybook/nextjs";

import { DatePicker } from "./date-picker";

const meta: Meta<typeof DatePicker> = {
  title: "UI/DatePicker",
  component: DatePicker,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    mode: {
      control: "inline-radio",
      options: ["date", "month"],
    },
    disabled: { control: "boolean" },
  },
  args: {
    mode: "date",
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DatePicker>;

export const DateMode: Story = {
  args: {
    mode: "date",
    label: "날짜 선택",
  },
};

export const MonthMode: Story = {
  args: {
    mode: "month",
    label: "월 선택",
  },
};

export const WithHint: Story = {
  args: {
    mode: "date",
    label: "시작일",
    hint: "프로젝트 시작 날짜를 선택하세요",
  },
};

export const WithError: Story = {
  args: {
    mode: "date",
    label: "종료일",
    error: "유효한 날짜를 선택해 주세요",
  },
};

export const Disabled: Story = {
  args: {
    mode: "date",
    label: "비활성화 날짜",
    disabled: true,
  },
};
