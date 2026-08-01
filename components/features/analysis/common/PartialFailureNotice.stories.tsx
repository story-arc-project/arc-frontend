import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";

import PartialFailureNotice, { describePartialFailure } from "./PartialFailureNotice";

// 안내는 항상 목록/통계 위에 놓인다 — 폭과 여백을 그 맥락에서 봐야 판단할 수 있다.
function PageColumn({ children }: { children: React.ReactNode }) {
  return <div className="w-[640px] max-w-full">{children}</div>;
}

const meta: Meta<typeof PartialFailureNotice> = {
  title: "Features/Analysis/PartialFailureNotice",
  component: PartialFailureNotice,
  parameters: { layout: "centered" },
  args: { onRetry: fn() },
  decorators: [
    (Story) => (
      <PageColumn>
        <Story />
      </PageColumn>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PartialFailureNotice>;

/** 목록 화면(전체 분석 결과)에서 한 유형만 못 불러온 상태. */
export const ListPartialFailure: Story = {
  args: {
    message:
      "종합 분석 기록을 불러오지 못했어요. 목록에 보이지 않을 뿐, 사라진 것은 아니에요.",
  },
};

/** 요약 화면(분석 홈·대시보드)에서 통계까지 흔들리는 상태. */
export const SummaryPartialFailure: Story = {
  args: {
    message: describePartialFailure(["keyword"], false) ?? "",
  },
};

/** 여러 소스가 동시에 실패해 문구가 길어졌을 때 줄바꿈·버튼 정렬. */
export const MultipleSourcesFailed: Story = {
  args: {
    message: describePartialFailure(["individual", "keyword"], true) ?? "",
  },
};

/** 재조회 수단이 없는 자리(버튼 없음). */
export const WithoutRetry: Story = {
  args: {
    message: describePartialFailure(["comprehensive"], false) ?? "",
    onRetry: undefined,
  },
};

/** 다시 시도가 실제로 재조회를 요청하는지. */
export const RetryInteraction: Story = {
  args: {
    message: describePartialFailure(["comprehensive"], false) ?? "",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};
