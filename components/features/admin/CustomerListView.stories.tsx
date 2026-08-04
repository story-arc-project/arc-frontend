import type { Meta, StoryObj } from "@storybook/nextjs";

import { CustomerListView } from "./CustomerListView";
import type { AdminCustomer } from "@/types/admin";

const sample: AdminCustomer[] = [
  {
    id: "c1",
    email: "jiwoo.kim@example.com",
    name: "김지우",
    status: "verified",
    onboarded: true,
    createdAt: "2026-06-14T02:11:00Z",
  },
  {
    id: "c2",
    email: "minho@example.com",
    name: "이민호",
    status: "unverified",
    onboarded: false,
    createdAt: "2026-05-02T09:30:00Z",
  },
  {
    id: "c3",
    email: "no-name@example.com",
    name: null,
    status: "unverified",
    onboarded: true,
    createdAt: "2026-04-20T12:00:00Z",
  },
  {
    id: "c4",
    email: "legacy@example.com",
    name: "박서연",
    // 백엔드 enum 확정 전 미지 상태 코드 — 원문 그대로 표시되는지 검증.
    status: "pending_review",
    onboarded: false,
    createdAt: "2026-03-11T00:00:00Z",
  },
];

const meta: Meta<typeof CustomerListView> = {
  title: "Features/Admin/CustomerListView",
  component: CustomerListView,
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
  },
  args: {
    onRetry: () => {},
    query: "",
  },
};

export default meta;

type Story = StoryObj<typeof CustomerListView>;

export const Populated: Story = {
  args: { customers: sample, isLoading: false, error: null },
};

export const Loading: Story = {
  args: { customers: [], isLoading: true, error: null },
};

export const ErrorState: Story = {
  args: {
    customers: [],
    isLoading: false,
    error: new Error("failed"),
  },
};

export const EmptyAll: Story = {
  args: { customers: [], isLoading: false, error: null, query: "" },
};

export const EmptySearch: Story = {
  args: { customers: [], isLoading: false, error: null, query: "zzz@nope.com" },
};
