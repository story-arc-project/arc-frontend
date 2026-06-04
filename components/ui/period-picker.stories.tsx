import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { PeriodPicker } from "./period-picker";

const meta: Meta<typeof PeriodPicker> = {
  title: "UI/PeriodPicker",
  component: PeriodPicker,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PeriodPicker>;

function DefaultRender() {
  const [value, setValue] = useState<string>("");

  return (
    <PeriodPicker
      label="기간"
      value={value}
      onChange={(v: string) => setValue(v)}
    />
  );
}

export const Default: Story = {
  render: () => <DefaultRender />,
};

function WithInitialValueRender() {
  const [value, setValue] = useState<string>("2023.03 ~ 2024.01");

  return (
    <div className="flex flex-col gap-2">
      <PeriodPicker
        label="근무 기간"
        value={value}
        onChange={(v: string) => setValue(v)}
      />
      <p className="text-caption text-text-tertiary">현재 값: {value}</p>
    </div>
  );
}

export const WithInitialValue: Story = {
  render: () => <WithInitialValueRender />,
};

function CurrentlyWorkingRender() {
  const [value, setValue] = useState<string>("2022.06 ~ 현재");

  return (
    <div className="flex flex-col gap-2">
      <PeriodPicker
        label="근무 기간"
        value={value}
        onChange={(v: string) => setValue(v)}
      />
      <p className="text-caption text-text-tertiary">현재 값: {value}</p>
    </div>
  );
}

export const CurrentlyWorking: Story = {
  render: () => <CurrentlyWorkingRender />,
};
