import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FeedbackModal } from "./FeedbackModal";
import { FEEDBACK_COMMENT_MAX_LENGTH } from "@/lib/feedback/campaigns";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록.
afterEach(cleanup);

function renderModal(
  overrides: Partial<React.ComponentProps<typeof FeedbackModal>> = {},
) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <FeedbackModal
      open
      campaignId="analysis-satisfaction"
      triggerSource="analysis_completed"
      onSubmit={onSubmit}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSubmit, onClose };
}

describe("FeedbackModal", () => {
  it("트리거에 맞는 질문 문구를 렌더한다", () => {
    renderModal();
    expect(
      screen.getByRole("heading", { name: "방금 이 분석, 도움이 됐나요?" }),
    ).toBeInTheDocument();
  });

  it("경험 도달 트리거는 다른 질문 문구를 쓴다", () => {
    renderModal({ triggerSource: "experience_threshold" });
    expect(
      screen.getByRole("heading", { name: "ARC에 기록해 보니 어떠셨나요?" }),
    ).toBeInTheDocument();
  });

  it("별점 미선택이면 자유텍스트가 숨겨지고 제출이 비활성이다", () => {
    renderModal();
    expect(screen.getByLabelText("한마디 의견 (선택)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });

  it("별점을 고르면 자유텍스트가 열리고 제출이 활성화된다", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("radio", { name: "별 4점" }));

    expect(screen.getByRole("radio", { name: "별 4점" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("한마디 의견 (선택)")).toBeEnabled();
    expect(screen.getByRole("button", { name: "보내기" })).toBeEnabled();
  });

  it("높은 점수는 high placeholder 를 쓴다", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("radio", { name: "별 5점" }));
    expect(screen.getByPlaceholderText("가장 좋았던 점이 있다면?")).toBeInTheDocument();
  });

  it("낮은 점수는 low placeholder 를 쓴다", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("radio", { name: "별 2점" }));
    expect(screen.getByPlaceholderText("무엇이 더 있으면 좋을까요?")).toBeInTheDocument();
  });

  it("제출 시 rating·trigger·comment·context 가 담긴 payload 로 onSubmit 을 호출하고 닫는다", async () => {
    const user = userEvent.setup();
    const context = { analysisId: "a-1", analysisType: "comprehensive" as const };
    const { onSubmit, onClose } = renderModal({ context });

    await user.click(screen.getByRole("radio", { name: "별 5점" }));
    await user.type(screen.getByLabelText("한마디 의견 (선택)"), "  좋았어요  ");
    await user.click(screen.getByRole("button", { name: "보내기" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      campaignId: "analysis-satisfaction",
      triggerSource: "analysis_completed",
      rating: 5,
      comment: "좋았어요", // 앞뒤 공백 trim
      context,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("코멘트가 비어 있으면 payload 에서 comment 를 생략한다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();
    await user.click(screen.getByRole("radio", { name: "별 3점" }));
    await user.click(screen.getByRole("button", { name: "보내기" }));

    expect(onSubmit).toHaveBeenCalledWith({
      campaignId: "analysis-satisfaction",
      triggerSource: "analysis_completed",
      rating: 3,
    });
  });

  it("코드포인트 상한을 넘는 입력은 잘라낸다", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("radio", { name: "별 3점" }));

    const textarea = screen.getByLabelText<HTMLTextAreaElement>("한마디 의견 (선택)");
    const long = "가".repeat(FEEDBACK_COMMENT_MAX_LENGTH + 20);
    await user.click(textarea);
    await user.paste(long);

    expect([...textarea.value].length).toBe(FEEDBACK_COMMENT_MAX_LENGTH);
  });

  it("닫기 버튼을 누르면 onClose 를 호출한다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape 로 닫으면 onClose 를 호출한다", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
