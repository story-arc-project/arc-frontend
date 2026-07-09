import type { Meta, StoryObj } from "@storybook/nextjs";

import { AdminEntryLink } from "./AdminEntryLink";

const meta: Meta<typeof AdminEntryLink> = {
  title: "Layout/AdminEntryLink",
  component: AdminEntryLink,
  parameters: {
    nextjs: { appDirectory: true },
  },
};

export default meta;

type Story = StoryObj<typeof AdminEntryLink>;

// admin 사용자 — 드롭다운 항목으로 노출.
export const AdminMenu: Story = {
  args: { isAdmin: true, variant: "menu" },
};

// admin 사용자 — 모바일 인라인 항목으로 노출.
export const AdminMobile: Story = {
  args: { isAdmin: true, variant: "mobile" },
};

// 비-admin — 아무것도 렌더하지 않는다(빈 스토리).
export const HiddenForNonAdmin: Story = {
  args: { isAdmin: false, variant: "menu" },
};
