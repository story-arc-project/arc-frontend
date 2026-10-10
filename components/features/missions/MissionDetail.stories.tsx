import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, within, userEvent } from "storybook/test";
import { getMission } from "@/lib/missions/catalog";
import { MissionDetail } from "./MissionDetail";
const meta = { title: "Features/Missions/Detail", component: MissionDetail, tags: ["frt348"], parameters: { layout: "fullscreen" }, args: { mission: getMission("M2"), progress: { missionId: "M2", status: "available", cycleId: "synthetic-cycle" }, draft: { url: "", note: "" }, mutation: { status: "idle" }, onDraft: fn(), onSubmit: fn(), onClaim: fn(), onBack: fn() }, render: function Controlled(args) { const [draft, setDraft] = useState(args.draft); return <MissionDetail {...args} draft={draft} onDraft={value => { setDraft(value); args.onDraft(value); }} />; } } satisfies Meta<typeof MissionDetail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Detail: Story = {};
export const Submission: Story = { play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole("button", { name: "검토 요청하기" })); await expect(canvas.getByRole("textbox", { name: "공개 게시물 주소" })).toHaveAttribute("aria-invalid", "true"); await userEvent.type(canvas.getByRole("textbox", { name: "공개 게시물 주소" }), "https://example.com/review"); await userEvent.click(canvas.getByRole("button", { name: "검토 요청하기" })); await expect(args.onSubmit).toHaveBeenCalledTimes(1); } };
export const Revision: Story = { args: { progress: { missionId: "M2", status: "needs_revision", reason: "후기 주소가 비공개예요. 공개 설정을 확인해 주세요.", cycleId: "synthetic-cycle" }, draft: { url: "https://example.com/review", note: "실제 사용 경험을 정리했어요." } }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("textbox", { name: "공개 게시물 주소" })).toHaveValue("https://example.com/review"); } };
export const Claimed: Story = { args: { progress: { missionId: "M2", status: "claimed" } }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByText("이 회차의 보상을 수령했어요.")).toBeVisible(); } };
export const Uncertain: Story = { args: { draft: { url: "https://example.com/review", note: "입력 내용 유지" }, mutation: { status: "uncertain", operation: "submit" } }, play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.getByRole("textbox", { name: "공개 게시물 주소" })).toBeDisabled(); await userEvent.click(canvas.getByRole("button", { name: "같은 요청으로 다시 확인" })); await expect(args.onSubmit).toHaveBeenCalled(); } };

export const UncertainSubmitAfterApproval: Story = {
  args: { progress: { missionId: "M2", status: "claimable", rewardId: "approved-remotely" }, draft: { url: "https://example.com/review", note: "응답 유실 전 증빙" }, mutation: { status: "uncertain", operation: "submit" } },
  play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.getByRole("textbox", { name: "공개 게시물 주소" })).toBeDisabled(); await expect(canvas.queryByRole("button", { name: "크레딧 받기" })).not.toBeInTheDocument(); await userEvent.click(canvas.getByRole("button", { name: "같은 요청으로 다시 확인" })); await expect(args.onSubmit).toHaveBeenCalled(); await expect(args.onClaim).not.toHaveBeenCalled(); },
};
export const UncertainClaimAfterRemoteCommit: Story = {
  args: { progress: { missionId: "M2", status: "claimed" }, mutation: { status: "uncertain", operation: "claim" } },
  play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.queryByRole("textbox", { name: "공개 게시물 주소" })).not.toBeInTheDocument(); await userEvent.click(canvas.getByRole("button", { name: "수령 결과 다시 확인" })); await expect(args.onClaim).toHaveBeenCalled(); },
};
export const UncertainClaimAfterLoadFailure: Story = {
  args: { progress: { missionId: "M2", status: "unavailable" }, mutation: { status: "uncertain", operation: "claim" } },
  play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole("button", { name: "수령 결과 다시 확인" })); await expect(args.onClaim).toHaveBeenCalled(); },
};
