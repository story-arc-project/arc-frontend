import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, waitFor, within } from "storybook/test";

import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

const meta: Meta<typeof DeleteConfirmDialog> = {
  title: "Export/DeleteConfirmDialog",
  component: DeleteConfirmDialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    title: "이 이력서를 삭제할까요?",
    description: "삭제하면 되돌릴 수 없어요.",
    deleting: false,
    onClose: () => {},
    onConfirm: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof DeleteConfirmDialog>;

export const Resume: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 파괴적 확인이 첫 포커스를 가져가면 Enter 한 번에 삭제된다 —
    // Dialog 는 첫 포커스 가능 요소로 포커스를 옮기므로 그 자리는 '취소'여야 한다.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        canvas.getByRole("button", { name: "취소" }),
      ),
    );
    await expect(canvas.getByRole("button", { name: "삭제하기" })).toBeEnabled();
  },
};

export const CoverLetter: Story = {
  args: {
    title: "이 자기소개서를 삭제할까요?",
  },
};

export const Deleting: Story = {
  args: { deleting: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 요청이 나간 뒤에는 취소도 재확인도 눌리지 않는다.
    await expect(canvas.getByRole("button", { name: "삭제 중..." })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "취소" })).toBeDisabled();
  },
};
