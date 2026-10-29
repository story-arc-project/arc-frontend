import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: "근무 기간" });
    await expect(within(group).getByLabelText("근무 기간 시작일")).toHaveAttribute("type", "month");
    await expect(within(group).getByLabelText("근무 기간 종료일")).toHaveAttribute("type", "month");
  },
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

function DayGranularityRender() {
  const [value, setValue] = useState<string>("2023.03.15 ~ 2024.01.20");

  return (
    <div className="flex flex-col gap-2">
      <PeriodPicker
        label="프로젝트 기간"
        value={value}
        onChange={(v: string) => setValue(v)}
      />
      <p className="text-caption text-text-tertiary">현재 값: {value}</p>
    </div>
  );
}

export const DayGranularity: Story = {
  render: () => <DayGranularityRender />,
};

function DayGranularityCurrentRender() {
  const [value, setValue] = useState<string>("2023.03.15 ~ 현재");

  return (
    <div className="flex flex-col gap-2">
      <PeriodPicker
        label="프로젝트 기간"
        value={value}
        onChange={(v: string) => setValue(v)}
      />
      <p className="text-caption text-text-tertiary">현재 값: {value}</p>
    </div>
  );
}

export const DayGranularityCurrent: Story = {
  render: () => <DayGranularityCurrentRender />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("프로젝트 기간 시작일")).toHaveAttribute("type", "date");
    await expect(canvas.getByLabelText("프로젝트 기간 종료일")).toBeDisabled();
  },
};
