import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import { PasswordInput } from "./password-input";

function Controlled(props: ComponentProps<typeof PasswordInput>) {
  const [visible, setVisible] = useState(false);
  return <PasswordInput {...props} visible={visible} onToggleVisibility={() => setVisible((v) => !v)} />;
}

const meta: Meta<typeof PasswordInput> = {
  title: "UI/PasswordInput",
  component: PasswordInput,
  render: (args) => <Controlled {...args} />,
  args: { label: "비밀번호", placeholder: "비밀번호 입력", visible: false, onToggleVisibility: () => {} },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof PasswordInput>;
export const Empty: Story = {};
export const Partial: Story = {
  args: { defaultValue: "arcpass123" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("비밀번호");
    await userEvent.click(canvas.getByRole("button", { name: "보기" }));
    await expect(input).toHaveAttribute("type", "text");
    await expect(input).toHaveValue("arcpass123");
    await userEvent.click(canvas.getByRole("button", { name: "숨기기" }));
    await expect(input).toHaveAttribute("type", "password");
  },
};
export const Error: Story = { args: { error: "비밀번호가 일치하지 않아요", defaultValue: "arcpass123" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "arcpass123" } };
