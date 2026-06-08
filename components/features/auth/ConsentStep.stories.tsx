import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";
import { ConsentStep } from "./ConsentStep";

const meta: Meta<typeof ConsentStep> = {
  title: "Features/Auth/ConsentStep",
  component: ConsentStep,
  parameters: { layout: "centered" },
  args: { onSubmit: fn(), isLoading: false, error: null },
};
export default meta;
type Story = StoryObj<typeof ConsentStep>;

export const Default: Story = {};

export const RequiredGatesNext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "다음" })).toBeDisabled();
  },
};

export const AgreeAllEnablesNext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("전체 동의"));
    await expect(canvas.getByRole("button", { name: "다음" })).toBeEnabled();
  },
};

export const RequiredOnlyEnablesNext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("서비스 이용약관 동의"));
    await userEvent.click(canvas.getByLabelText("개인정보 수집·이용 동의 (서비스 제공)"));
    await userEvent.click(canvas.getByLabelText("만 14세 이상입니다"));
    await expect(canvas.getByRole("button", { name: "다음" })).toBeEnabled();
  },
};

export const ErrorState: Story = {
  args: { error: "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요." },
};
