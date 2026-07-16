import type { Meta, StoryObj } from "@storybook/nextjs";
import { AlertTriangle, FileQuestion } from "lucide-react";

import { FullPageMessage } from "./FullPageMessage";
import { Button } from "./button";

const meta: Meta<typeof FullPageMessage> = {
  title: "UI/FullPageMessage",
  component: FullPageMessage,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof FullPageMessage>;

/** route 레벨 error.tsx — 친절한 메시지 + 재시도 버튼 */
export const RouteError: Story = {
  render: () => (
    <FullPageMessage
      role="alert"
      icon={<AlertTriangle size={22} aria-hidden="true" />}
      title="문제가 발생했어요"
      description="잠시 후 다시 시도해 주세요. 계속되면 새로고침해 주세요."
    >
      <Button variant="secondary" size="sm">
        다시 시도
      </Button>
    </FullPageMessage>
  ),
};

/** 루트 not-found.tsx — 404 브랜드 화면 */
export const NotFound: Story = {
  render: () => (
    <FullPageMessage
      fill="viewport"
      icon={<FileQuestion size={22} aria-hidden="true" />}
      title="페이지를 찾을 수 없어요"
      description="요청하신 페이지가 없거나 이동되었어요."
    >
      <Button variant="secondary" size="sm">
        홈으로 가기
      </Button>
    </FullPageMessage>
  ),
};

/** 설명·아이콘 없이 제목과 액션만 */
export const TitleOnly: Story = {
  render: () => (
    <FullPageMessage title="문제가 발생했어요">
      <Button variant="secondary" size="sm">
        다시 시도
      </Button>
    </FullPageMessage>
  ),
};

/** 모바일 뷰포트 — 좁은 화면에서도 카드가 자연스럽게 보이는지 확인 */
export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  render: () => (
    <FullPageMessage
      role="alert"
      icon={<AlertTriangle size={22} aria-hidden="true" />}
      title="문제가 발생했어요"
      description="잠시 후 다시 시도해 주세요."
    >
      <Button variant="secondary" size="sm">
        다시 시도
      </Button>
    </FullPageMessage>
  ),
};
