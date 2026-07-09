import type { Meta, StoryObj } from "@storybook/nextjs";

import { AdminNav } from "./AdminNav";

const meta: Meta<typeof AdminNav> = {
  title: "Features/Admin/AdminNav",
  component: AdminNav,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;

type Story = StoryObj<typeof AdminNav>;

export const OverviewActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/admin",
      },
    },
  },
};

export const CustomersActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/admin/customers",
      },
    },
  },
};

export const AnalyticsActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/admin/analytics",
      },
    },
  },
};

export const AuditLogActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/admin/audit-log",
      },
    },
  },
};
