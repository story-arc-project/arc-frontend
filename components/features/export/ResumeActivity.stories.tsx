import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";
import { PreviewActivity } from "@/app/(main)/export/resume/[versionId]/_components/preview/PreviewActivity";
import { resumeSectionLabels } from "@/lib/export/resume-labels";
import type { Activity } from "@/types/resume";

function activity(overrides: Partial<Activity> = {}): Activity {
  return { id: 1, 활동명: null, 기관: null, 역할: null, 기간_시작: null, 기간_종료: null, 기간_원문: null, 진행중: false, 활동내용: [], 성과: [], ...overrides };
}
const meta = {
  title: "Export/ResumeActivity",
  component: PreviewActivity,
  args: { labels: resumeSectionLabels("ko") },
  decorators: [Story => <div className="max-w-2xl p-6"><Story /></div>],
} satisfies Meta<typeof PreviewActivity>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { data: [activity({ 진행중: true }), activity({ id: 2, 기간_원문: "2024년" })] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("heading", { name: "대외활동" })).not.toBeInTheDocument();
    await expect(canvas.queryByText("현재")).not.toBeInTheDocument();
  },
};

export const Mixed: Story = {
  args: { data: [activity({ 진행중: true }), activity({ id: 2, 기관: "지역 기관", 활동내용: ["행사 운영"] }), activity({ id: 3, 활동명: "숨긴 활동", 표시: false })] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("지역 기관")).toBeVisible();
    await expect(canvas.getByText("행사 운영")).toBeVisible();
    await expect(canvas.queryByText("현재")).not.toBeInTheDocument();
    await expect(canvas.queryByText("숨긴 활동")).not.toBeInTheDocument();
  },
};

export const Current: Story = {
  args: { data: [activity({ 활동명: "지역 봉사 활동", 기관: "청년 센터", 역할: "운영", 기간_시작: "2024-01", 진행중: true, 활동내용: ["주말 교육 프로그램 운영"], 성과: ["참가자 20명 지원"] })] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("지역 봉사 활동")).toBeVisible();
    await expect(canvas.getByText("2024-01 – 현재")).toBeVisible();
    await expect(canvas.getByText("참가자 20명 지원")).toBeVisible();
  },
};
