import type { Meta, StoryObj } from "@storybook/nextjs";

import { CoverLetterPreview } from "./CoverLetterPreview";
import type { CoverLetterResult } from "@/types/cover-letter";

const BODY = `저는 학부 2학년 때 교내 데이터 분석 학회에 들어가면서 데이터를 다루기 시작했습니다. 처음 맡은 일은 설문 응답 3,000건을 정리하는 것이었고, 반복되는 전처리를 파이썬 스크립트로 바꾸어 작업 시간을 이틀에서 두 시간으로 줄였습니다.

이후 팀 프로젝트에서는 이탈률이 높은 구간을 찾는 분석을 맡았습니다. 3년간 팀장 경험을 살려 일정을 조율했고, 최종 발표에서 학회 우수상을 받았습니다.`;

const base: CoverLetterResult = {
  answers: [
    {
      question: "지원 동기와 본인의 강점을 서술하시오. (1,000자 이내)",
      cover_letter: BODY,
      grounding: { grounded: true, unsupported_claims: [], notes: "" },
      max_chars: 1000,
    },
  ],
};

const flagged: CoverLetterResult = {
  answers: [
    {
      ...base.answers[0],
      grounding: {
        grounded: false,
        unsupported_claims: ["3년간 팀장 경험을 살려", "본문에 없는 주장입니다"],
        notes: "근거 없는 주장 2건",
      },
    },
  ],
};

const meta: Meta<typeof CoverLetterPreview> = {
  title: "features/export/CoverLetterPreview",
  component: CoverLetterPreview,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="bg-surface-secondary p-8">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof CoverLetterPreview>;

export const 기본: Story = { args: { result: base } };

/** 근거 없는 주장이 본문 위에 물결 밑줄로 표시된다(색만으로 알리지 않는다). */
export const 근거_하이라이트: Story = { args: { result: flagged } };

/** 본문을 고치면 하이라이트 위치가 낡아 표시를 끈다(명세: "수정 시 해제"). */
export const 편집_후_하이라이트_해제: Story = {
  args: {
    result: {
      answers: [{ ...flagged.answers[0], cover_letter: "사용자가 고쳐 쓴 본문입니다." }],
    },
    original: flagged,
  },
};

export const 문항_여러개: Story = {
  args: {
    result: {
      answers: [
        base.answers[0],
        {
          question: "입사 후 목표를 서술하시오.",
          cover_letter: "데이터로 의사결정을 돕는 사람이 되고 싶습니다.",
          grounding: { grounded: true, unsupported_claims: [], notes: "" },
          max_chars: 500,
        },
      ],
    },
  },
};

export const 빈_결과: Story = { args: { result: { answers: [] } } };
