import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";
import { InsufficientCreditsDialog } from "./InsufficientCreditsDialog";

const meta = {
  title: "Features/Credits/InsufficientCreditsDialog",
  component: InsufficientCreditsDialog,
  args: { open: true, onClose: fn() },
} satisfies Meta<typeof InsufficientCreditsDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("dialog", { name: "크레딧이 부족해요" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "충전 페이지로 이동" })).toHaveAttribute("href", "/credits/charge");
    await userEvent.click(canvas.getByRole("button", { name: "닫기" }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};
