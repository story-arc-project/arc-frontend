import type { Meta, StoryObj } from "@storybook/nextjs";

import { ToastContainer, toast } from "./toast";
import { Button } from "./button";

const meta: Meta<typeof ToastContainer> = {
  title: "UI/Toast",
  component: ToastContainer,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <ToastContainer />
      </>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ToastContainer>;

export const Info: Story = {
  render: () => (
    <Button variant="secondary" onClick={() => toast("정보 메시지입니다", "info")}>
      Info 토스트
    </Button>
  ),
};

export const Success: Story = {
  render: () => (
    <Button variant="primary" onClick={() => toast.success("저장되었습니다!")}>
      Success 토스트
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button variant="destructive" onClick={() => toast.error("오류가 발생했습니다")}>
      Error 토스트
    </Button>
  ),
};

export const AllTypes: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => toast("정보 메시지", "info")}>
        Info
      </Button>
      <Button variant="primary" onClick={() => toast.success("성공 메시지")}>
        Success
      </Button>
      <Button variant="destructive" onClick={() => toast.error("오류 메시지")}>
        Error
      </Button>
    </div>
  ),
};
