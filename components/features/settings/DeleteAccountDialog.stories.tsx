import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { http, HttpResponse } from "msw";
import { expect, userEvent, within } from "storybook/test";

import { DeleteAccountDialog } from "./DeleteAccountDialog";

const meta: Meta<typeof DeleteAccountDialog> = {
  title: "Features/Settings/DeleteAccountDialog",
  component: DeleteAccountDialog,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof DeleteAccountDialog>;

function Wrapper(props: { isSocialAccount: boolean; connectedOauth: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <DeleteAccountDialog
      open={open}
      onClose={() => setOpen(false)}
      isSocialAccount={props.isSocialAccount}
      connectedOauth={props.connectedOauth}
    />
  );
}

export const PasswordAccount: Story = {
  render: () => <Wrapper isSocialAccount={false} connectedOauth={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "탈퇴하기" });
    await expect(button).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("현재 비밀번호"), "pw123");
    await expect(button).toBeEnabled();
  },
};

export const SocialAccount: Story = {
  render: () => <Wrapper isSocialAccount connectedOauth={["google"]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Google 인증하고 탈퇴하기" }),
    ).toBeEnabled();
  },
};

export const PasswordError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.delete("*/auth/account/password", () =>
          HttpResponse.json({ message: "unauthorized" }, { status: 401 }),
        ),
        http.post("*/auth/refresh", () => new HttpResponse(null, { status: 401 })),
      ],
    },
  },
  render: () => <Wrapper isSocialAccount={false} connectedOauth={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("현재 비밀번호"), "wrong");
    await userEvent.click(canvas.getByRole("button", { name: "탈퇴하기" }));
    await expect(await canvas.findByText("비밀번호가 올바르지 않아요.")).toBeVisible();
  },
};
