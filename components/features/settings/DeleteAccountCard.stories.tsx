import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";

import { DeleteAccountCard } from "./DeleteAccountCard";

const meta: Meta<typeof DeleteAccountCard> = {
  title: "Features/Settings/DeleteAccountCard",
  component: DeleteAccountCard,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof DeleteAccountCard>;

export const PasswordAccount: Story = {
  args: { isSocialAccount: false, connectedOauth: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "회원 탈퇴" }));
    await expect(await canvas.findByLabelText("현재 비밀번호")).toBeVisible();
  },
};

export const SocialAccount: Story = {
  args: { isSocialAccount: true, connectedOauth: ["google"] },
};
