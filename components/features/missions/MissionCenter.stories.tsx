import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, within, userEvent } from "storybook/test";
import { MISSIONS } from "@/lib/missions/catalog";
import type { MissionState, MissionStatus } from "@/lib/missions/types";
import { MissionCenter } from "./MissionCenter";

const statuses: MissionStatus[] = ["available", "needs_revision", "available", "closed", "closed", "reviewing", "claimable", "claimable", "claimed", "available"];
const state: MissionState = { status: "success", snapshot: { version: "storybook-synthetic", missions: MISSIONS.map((mission, index) => ({ missionId: mission.id, status: statuses[index], cycleId: `synthetic-${mission.id}`, rewardId: `reward-${mission.id}` })) }, refreshing: false, drafts: {}, mutations: {} };
const meta = { title: "Features/Missions/Center", component: MissionCenter, tags: ["frt348"], parameters: { layout: "fullscreen" }, args: { state, balance: <strong style={{ fontSize: 28, margin: "12px 0" }}>12 크레딧</strong>, onBack: fn(), onRetry: fn(), onOpen: fn(), onClaim: fn() } } satisfies Meta<typeof MissionCenter>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Mixed: Story = { play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); for (const mission of MISSIONS) await expect(canvas.getByRole("heading", { name: mission.title })).toBeVisible(); await userEvent.click(canvas.getAllByRole("button", { name: "크레딧 받기" })[0]); await expect(args.onClaim).toHaveBeenCalledWith("M7"); } };
export const Loading: Story = { args: { state: { ...state, status: "loading", snapshot: null } }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("status", { name: "미션 불러오는 중" })).toBeVisible(); } };
export const Error: Story = { args: { state: { ...state, status: "error", snapshot: null } }, play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole("button", { name: "다시 불러오기" })); await expect(args.onRetry).toHaveBeenCalled(); } };
export const Empty: Story = { args: { state: { ...state, snapshot: { version: "empty", missions: [] } } } };
export const Partial: Story = { args: { state: { ...state, snapshot: { version: "partial", missions: [{ missionId: "M7", status: "claimable", rewardId: "synthetic-reward" }] } } }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getAllByText("상태 확인 불가")).toHaveLength(9); } };
export const Unavailable: Story = { args: { state: { ...state, status: "unavailable", snapshot: null } } };
export const Uncertain: Story = { args: { state: { ...state, mutations: { M7: { status: "uncertain", operation: "claim", message: "수령 결과를 확인하지 못했어요." } } } }, play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole("button", { name: "수령 결과 다시 확인" })); await expect(args.onClaim).toHaveBeenCalledWith("M7"); } };

export const UncertainClaimAfterLoadFailure: Story = {
  args: { state: { ...state, status: "error", snapshot: null, mutations: { M7: { status: "uncertain", operation: "claim" } } } },
  play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole("button", { name: "수령 결과 다시 확인" })); await expect(args.onClaim).toHaveBeenCalledWith("M7"); },
};
export const UncertainSubmitAfterApproval: Story = {
  args: { state: { ...state, snapshot: { version: "remote-approval", missions: [{ missionId: "M2", status: "claimable", rewardId: "remote-reward" }] }, mutations: { M2: { status: "uncertain", operation: "submit" } } } },
  play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.queryByRole("button", { name: "크레딧 받기" })).not.toBeInTheDocument(); await userEvent.click(canvas.getByRole("button", { name: "제출 결과 다시 확인" })); await expect(args.onOpen).toHaveBeenCalledWith("M2"); await expect(args.onClaim).not.toHaveBeenCalled(); },
};
