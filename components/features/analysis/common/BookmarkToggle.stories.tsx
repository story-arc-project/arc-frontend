import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";

import BookmarkToggle from "./BookmarkToggle";

/**
 * `BookmarkToggle`은 클릭 시 `@/lib/api/analysis-api`의 add/removeBookmark를 직접 호출한다.
 * 전역 MSW 핸들러(`lib/mocks/handlers.ts`, preview에 등록)가 이 fetch를 204로 가로채므로
 * 실제 백엔드 없이 결정적으로 토글된다. 미가로챈 API 요청은 preview의 onUnhandledRequest가
 * 에러로 표면화한다.
 */
const meta: Meta<typeof BookmarkToggle> = {
  title: "Features/Analysis/BookmarkToggle",
  component: BookmarkToggle,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["sm", "md"],
    },
  },
  args: {
    analysisId: "demo-1",
    size: "md",
  },
};

export default meta;

type Story = StoryObj<typeof BookmarkToggle>;

export const Default: Story = {
  args: { isBookmarked: false },
};

export const Bookmarked: Story = {
  args: { isBookmarked: true },
};

/**
 * 미북마크 → 클릭 → add 요청을 MSW가 가로채 성공 경로가 실행된다.
 * 라벨이 바뀌고 onToggled(true)가 호출되면 mock이 동작한 것이다.
 * (mock이 없다면 401 → silent catch[BookmarkToggle.tsx:37] → 라벨 불변·콜백 미호출로 실패.)
 */
export const TogglesOn: Story = {
  args: { isBookmarked: false, onToggled: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "즐겨찾기" }));
    await canvas.findByRole("button", { name: "즐겨찾기 해제" });
    await expect(args.onToggled).toHaveBeenCalledWith(true);
  },
};

/**
 * 북마크됨 → 클릭 → remove 요청(DELETE)을 MSW가 가로채 해제된다.
 * add/remove 양쪽 핸들러가 모두 동작함을 보장한다.
 */
export const TogglesOff: Story = {
  args: { isBookmarked: true, onToggled: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "즐겨찾기 해제" }));
    await canvas.findByRole("button", { name: "즐겨찾기" });
    await expect(args.onToggled).toHaveBeenCalledWith(false);
  },
};
