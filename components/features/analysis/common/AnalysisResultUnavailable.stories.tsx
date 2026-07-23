import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, within } from "storybook/test";

import AnalysisResultUnavailable from "./AnalysisResultUnavailable";

const meta: Meta<typeof AnalysisResultUnavailable> = {
  title: "Features/Analysis/AnalysisResultUnavailable",
  component: AnalysisResultUnavailable,
  parameters: { layout: "fullscreen" },
  args: {
    basePath: "",
    fallbackHref: "/analysis/individual",
    analysisId: "ind-1",
    onRetried: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof AnalysisResultUnavailable>;

/**
 * 분석이 아직 돌고 있는 상태. 회귀 전에는 헤더와 구분선만 남은 빈 화면이 떠서
 * 진행 중인지 실패인지 구분할 수 없었다.
 */
export const InProgress: Story = {
  args: { status: "processing" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("분석이 아직 진행 중이에요")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "목록으로 돌아가기" })).toBeVisible();
  },
};

/** 개별 분석 실패 — 재시도 엔드포인트가 없어 안내와 목록 링크만 준다. */
export const FailedWithoutRetry: Story = {
  args: { status: "failed" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("분석에 실패했습니다")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /다시 시도/ })).toBeNull();
  },
};

/**
 * 종합·키워드 실패 — 재시도 플래그가 켜지면 그 자리에서 다시 시도할 수 있다.
 * 플래그 평가는 호출부가 하고 이 컴포넌트는 canRetry 만 받는다(FRT-108 교훈).
 */
export const FailedWithRetry: Story = {
  args: {
    status: "failed",
    fallbackHref: "/analysis/comprehensive",
    analysisId: "comp-1",
    analysisType: "comprehensive",
    canRetry: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "다시 시도" })).toBeEnabled();
  },
};

/** 완료로 표시됐는데 본문이 비어 온 이상 상태 — 실패로 단정하지 않는다. */
export const CompletedButEmpty: Story = {
  args: { status: "completed", fallbackHref: "/analysis/keyword", analysisId: "kw-1" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("결과를 표시할 수 없습니다")).toBeVisible();
  },
};
