import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";

import { CustomerSearchBar } from "./CustomerSearchBar";

const meta: Meta<typeof CustomerSearchBar> = {
  title: "Features/Admin/CustomerSearchBar",
  component: CustomerSearchBar,
  parameters: { layout: "padded" },
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState(args.value);
    return <CustomerSearchBar {...args} value={value} onChange={setValue} />;
  },
};

export default meta;

type Story = StoryObj<typeof CustomerSearchBar>;

export const Empty: Story = {
  args: { value: "" },
};

export const Filled: Story = {
  args: { value: "kim@example.com" },
};

// 입력하면 지우기 버튼이 나타나고, 누르면 비워진다.
export const TypeThenClear: Story = {
  args: { value: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", {
      name: "이메일 또는 이름으로 고객 검색",
    });
    await userEvent.type(input, "지우");
    await expect(input).toHaveValue("지우");
    const clear = canvas.getByRole("button", { name: "검색어 지우기" });
    await userEvent.click(clear);
    await expect(input).toHaveValue("");
  },
};
