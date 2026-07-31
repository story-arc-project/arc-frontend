import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    disabled: { control: "boolean" },
  },
  args: {
    placeholder: "입력하세요",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    label: "이름",
    placeholder: "홍길동",
  },
};

export const WithHint: Story = {
  args: {
    label: "이메일",
    hint: "업무용 이메일을 입력해 주세요",
    placeholder: "email@example.com",
  },
};

export const WithError: Story = {
  args: {
    label: "이메일",
    error: "유효한 이메일 주소를 입력해 주세요",
    placeholder: "email@example.com",
    defaultValue: "잘못된이메일",
  },
};

export const Disabled: Story = {
  args: {
    label: "비활성화 필드",
    disabled: true,
    defaultValue: "편집 불가",
  },
};

/** 애드온이 입력칸 세로 중앙에 놓였는지 검사한다.
 *  좌표를 하드코딩하던 시절엔 라벨 높이·간격이 바뀌면 조용히 어긋났다. */
const expectAddonCenteredOnInput = async (
  canvasElement: HTMLElement,
  labelText: string,
  addonName: string
) => {
  const canvas = within(canvasElement);
  const inputBox = canvas.getByLabelText(labelText).getBoundingClientRect();
  const addonBox = canvas.getByRole("button", { name: addonName }).getBoundingClientRect();

  const inputCenter = inputBox.top + inputBox.height / 2;
  const addonCenter = addonBox.top + addonBox.height / 2;

  expect(Math.abs(addonCenter - inputCenter)).toBeLessThanOrEqual(1);
};

export const WithRightAddon: Story = {
  args: {
    label: "비밀번호",
    type: "password",
    placeholder: "비밀번호 입력",
    defaultValue: "supersecret",
    className: "pr-14",
    rightAddon: (
      <button
        type="button"
        className="text-caption text-text-tertiary hover:text-text-secondary
                   transition-colors cursor-pointer select-none"
      >
        보기
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    await expectAddonCenteredOnInput(canvasElement, "비밀번호", "보기");
  },
};

/** 에러 문구가 아래에 붙어도 애드온 위치는 입력칸에만 매인다. */
export const WithRightAddonAndError: Story = {
  args: {
    label: "비밀번호 확인",
    type: "password",
    placeholder: "비밀번호를 다시 입력해주세요",
    defaultValue: "supersecrat",
    error: "비밀번호가 일치하지 않아요",
    className: "pr-14",
    rightAddon: (
      <button
        type="button"
        className="text-caption text-text-tertiary hover:text-text-secondary
                   transition-colors cursor-pointer select-none"
      >
        보기
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    await expectAddonCenteredOnInput(canvasElement, "비밀번호 확인", "보기");
  },
};
