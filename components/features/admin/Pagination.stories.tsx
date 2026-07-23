import type { Meta, StoryObj } from "@storybook/nextjs";

import { Pagination } from "./Pagination";

const meta: Meta<typeof Pagination> = {
  title: "Features/Admin/Pagination",
  component: Pagination,
  parameters: { layout: "padded" },
  args: {
    pageSize: 20,
    onPageChange: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof Pagination>;

export const FirstPage: Story = {
  args: { page: 1, totalCount: 137 },
};

export const MiddlePage: Story = {
  args: { page: 4, totalCount: 137 },
};

export const LastPage: Story = {
  args: { page: 7, totalCount: 137 },
};

export const SinglePage: Story = {
  args: { page: 1, totalCount: 12 },
};

export const Empty: Story = {
  args: { page: 1, totalCount: 0 },
};
