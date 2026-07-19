import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { FeedbackModal } from "./FeedbackModal";
import type { FeedbackPayload, FeedbackTriggerSource } from "@/lib/feedback/types";

const meta: Meta<typeof FeedbackModal> = {
  title: "Features/Feedback/FeedbackModal",
  component: FeedbackModal,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof FeedbackModal>;

function Wrapper(props: {
  triggerSource?: FeedbackTriggerSource;
  onSubmit?: (payload: FeedbackPayload) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <FeedbackModal
      open={open}
      campaignId="analysis-satisfaction"
      triggerSource={props.triggerSource ?? "analysis_completed"}
      context={{ analysisId: "demo-1", analysisType: "comprehensive" }}
      onSubmit={props.onSubmit ?? (() => {})}
      onClose={() => setOpen(false)}
    />
  );
}

/** 진입 직후 — 별점 미선택, 자유텍스트는 접혀 있고 제출은 비활성. */
export const Default: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "방금 이 분석, 도움이 됐나요?" }),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "보내기" })).toBeDisabled();
  },
};

/** 높은 점수 선택 → 자유텍스트가 열리고 "가장 좋았던 점" placeholder. */
export const HighScoreSelected: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("radio", { name: "별 5점" }));
    await expect(
      await canvas.findByPlaceholderText("가장 좋았던 점이 있다면?"),
    ).toBeEnabled();
    await expect(
      await canvas.findByRole("button", { name: "보내기" }),
    ).toBeEnabled();
  },
};

/** 낮은 점수 선택 → 같은 텍스트칸, "무엇이 더 있으면" placeholder(점수 무관 항상 열림). */
export const LowScoreSelected: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("radio", { name: "별 2점" }));
    // 리빌은 opacity 200ms 전환이라 클릭 직후 toBeVisible 은 애니메이션 중간값(opacity~0)에
    // 걸린다. disabled={!revealed} 해제(=enabled)로 "열렸음"을 결정적으로 검증한다.
    await expect(
      await canvas.findByPlaceholderText("무엇이 더 있으면 좋을까요?"),
    ).toBeEnabled();
  },
};

/** 경험 도달 게이트 — 분석을 한 적 없는 사용자라 질문 문구가 다르다. */
export const ExperienceThresholdTrigger: Story = {
  render: () => <Wrapper triggerSource="experience_threshold" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "ARC에 기록해 보니 어떠셨나요?" }),
    ).toBeVisible();
  },
};

/** 제출 흐름 — 별점+코멘트 입력 후 onSubmit 이 payload 로 호출된다. */
export const SubmitFlow: Story = {
  render: () => <Wrapper onSubmit={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 별점 클릭 → 자유텍스트 리빌은 200ms opacity/grid 전환이다. 실제 브라우저(test-runner)
    // 에선 전환·입력 정착 사이에 동기 getBy 가 순간적으로 빗나갈 수 있어 async findBy 로 정착을
    // 기다린다(jsdom 은 즉시 통과하지만 chromium 타이밍에 걸렸음).
    await userEvent.click(await canvas.findByRole("radio", { name: "별 4점" }));
    await userEvent.type(
      await canvas.findByLabelText("한마디 의견 (선택)"),
      "흐름이 매끄러웠어요",
    );
    await userEvent.click(await canvas.findByRole("button", { name: "보내기" }));
    // 제출 후 모달이 닫힌다(언마운트도 비동기이므로 waitFor 로 관찰).
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "보내기" }),
      ).not.toBeInTheDocument(),
    );
  },
};
