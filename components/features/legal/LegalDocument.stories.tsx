import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

import { LegalDocument } from "./LegalDocument";

const TERMS_MARKDOWN = `# ARC 서비스 이용약관 (잠정 초안)

## 제1조 (목적)

이 약관은 ARC 서비스의 이용 조건과 절차를 정합니다.

## 제2조 (개인정보)

개인정보의 처리에 관한 사항은 별도의 **개인정보 처리방침**에 따릅니다.
`;

const PRIVACY_MARKDOWN = `# ARC 개인정보 처리방침 (잠정 초안)

## 1. 처리 목적

회사는 서비스 제공을 위해 최소한의 개인정보를 처리합니다.
`;

const meta: Meta<typeof LegalDocument> = {
  title: "Features/Legal/LegalDocument",
  component: LegalDocument,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj<typeof LegalDocument>;

/**
 * 이용약관. 문서를 다 읽은 자리(하단)에서 개인정보 처리방침으로 넘어갈 수 있어야 한다.
 * 회귀 전에는 '← ARC' 뿐이라 두 법적 문서 사이를 오갈 방법이 없었다(FRT-127).
 */
export const Terms: Story = {
  args: {
    markdown: TERMS_MARKDOWN,
    crossLink: { href: "/privacy", label: "개인정보 처리방침" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "← ARC" })).toHaveAttribute("href", "/");

    // 크로스링크는 '다른' 문서를 가리켜야 한다. Privacy 스토리를 대조군으로 함께 두어,
    // 양쪽이 자기 자신을 가리키게 되는 회귀(호출부 복사 실수)가 한쪽에서라도 드러나게 한다.
    const cross = canvas.getByRole("link", { name: /개인정보 처리방침/ });
    await expect(cross).toHaveAttribute("href", "/privacy");
  },
};

/** 개인정보 처리방침 — 반대 방향. 본문의 평문 '개인정보 처리방침'과 달리 이쪽 크로스링크는 이용약관을 가리킨다. */
export const Privacy: Story = {
  args: {
    markdown: PRIVACY_MARKDOWN,
    crossLink: { href: "/terms", label: "이용약관" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "← ARC" })).toHaveAttribute("href", "/");

    const cross = canvas.getByRole("link", { name: /이용약관/ });
    await expect(cross).toHaveAttribute("href", "/terms");
  },
};
