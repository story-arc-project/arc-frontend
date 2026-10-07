import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";

import { CreditBalanceView } from "./CreditBalance";
import type { CreditsState } from "@/types/credits";

const balance = {
  balance: 50,
  reserved: 3,
  available: 47,
  updated_at: "2026-10-02T12:00:00Z",
};

const success: CreditsState = {
  data: balance,
  status: "success",
  error: null,
  isRefreshing: false,
  isStale: false,
};

const meta: Meta<typeof CreditBalanceView> = {
  title: "Features/Credits/CreditBalance",
  component: CreditBalanceView,
  parameters: { layout: "centered" },
  args: {
    state: success,
    onRetry: fn(),
    variant: "summary",
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["summary", "compact"] },
  },
};

export default meta;
type Story = StoryObj<typeof CreditBalanceView>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("50 크레딧")).toBeVisible();
    await expect(canvas.queryByText(/47 크레딧|예약액|사용 가능/)).toBeNull();
  },
};

export const Compact: Story = {
  args: { variant: "compact" },
};

export const Zero: Story = {
  args: {
    state: { ...success, data: { ...balance, balance: 0, reserved: 0, available: 0 } },
  },
};

export const Idle: Story = {
  args: {
    state: { data: null, status: "idle", error: null, isRefreshing: false, isStale: false },
  },
};

export const Loading: Story = {
  args: {
    state: { data: null, status: "loading", error: null, isRefreshing: false, isStale: false },
  },
};

export const ErrorState: Story = {
  args: {
    state: {
      data: null,
      status: "error",
      error: new Error("network error"),
      isRefreshing: false,
      isStale: false,
    },
    onRetry: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

export const Unavailable: Story = {
  args: {
    state: {
      ...success,
      status: "unavailable",
      error: new Error("not available"),
    },
  },
};

export const Refreshing: Story = {
  args: {
    state: { ...success, isRefreshing: true, isStale: true },
  },
};

export const StaleError: Story = {
  args: {
    state: {
      ...success,
      status: "error",
      error: new Error("refresh failed"),
      isStale: true,
    },
  },
};

export const MaximumSafeInteger: Story = {
  args: {
    state: {
      ...success,
      data: {
        balance: Number.MAX_SAFE_INTEGER,
        reserved: 0,
        available: Number.MAX_SAFE_INTEGER,
        updated_at: "2026-10-02T12:00:00Z",
      },
    },
  },
  decorators: [
    (StoryComponent) => (
      <div className="w-40 border border-border p-3">
        <StoryComponent />
      </div>
    ),
  ],
};
