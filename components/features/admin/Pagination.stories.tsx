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

// 서버가 count 를 안 준 경우(계약 위반 폴백). 총계를 지어내지 않고 현재 범위만 알리며,
// 페이지가 꽉 찼으면 다음으로 갈 수 있어야 남은 결과가 묻히지 않는다.
export const UnknownTotal: Story = {
  args: { page: 2, totalCount: null, pageItemCount: 20 },
};

export const UnknownTotalLastPage: Story = {
  args: { page: 3, totalCount: null, pageItemCount: 7 },
};
