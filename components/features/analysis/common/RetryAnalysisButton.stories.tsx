import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { http, HttpResponse } from "msw";

import RetryAnalysisButton from "./RetryAnalysisButton";

// 실패 카드 안에 놓였을 때의 맥락을 재현한다 — 버튼만 떼어 보면 여백·정렬을 판단할 수 없다.
function FailedCard({ children }: { children: React.ReactNode }) {
  return (
    // 재시도 가능한 카드는 호출부에서 opacity 를 걷어낸다(버튼이 흐려지면 못 누른다).
    <div className="bg-surface border border-border rounded-lg p-4 w-[420px]">
      <span className="text-body-sm text-text-primary font-medium">
        디자인 동아리 등 3개 분석
      </span>
      <p className="text-body-sm text-text-tertiary mt-1">분석에 실패했습니다</p>
      {children}
    </div>
  );
}

const meta: Meta<typeof RetryAnalysisButton> = {
  title: "Features/Analysis/RetryAnalysisButton",
  component: RetryAnalysisButton,
  parameters: { layout: "centered" },
  args: {
    analysisId: "comp-1",
    analysisType: "comprehensive",
    onRetried: fn(),
  },
  decorators: [
    (Story) => (
      <FailedCard>
        <Story />
      </FailedCard>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof RetryAnalysisButton>;

/** 기본 상태 — 실패 카드에 재시도 버튼이 붙는다. */
export const Idle: Story = {};

/**
 * 재시도를 눌러 요청이 접수된 흐름.
 * 버튼이 잠기고("요청 중…") 부모에 통지가 간다 → 호출부가 카드를 '진행 중'으로 바꾼다.
 */
export const RetryFlow: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "다시 시도" });
    await expect(button).toBeEnabled();
    await userEvent.click(button);
    await waitFor(() => expect(args.onRetried).toHaveBeenCalled());
  },
};

/**
 * 재시도 요청 자체가 실패한 경우(409 = 이미 실패 상태가 아님 등).
 * 안내만 띄우고 카드는 실패 상태로 남긴다 — 부모에 통지하지 않는다.
 */
export const RequestFailed: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("*/analysis/comprehensive/:id/retry", () =>
          HttpResponse.json({ message: "Conflict" }, { status: 409 }),
        ),
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await canvas.findByRole("alert");
    await expect(args.onRetried).not.toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: "다시 시도" })).toBeEnabled();
  },
};

/** 키워드 분석 실패 카드에서도 같은 버튼을 쓴다. */
export const Keyword: Story = {
  args: { analysisId: "kw-1", analysisType: "keyword" },
};
