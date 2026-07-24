import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { CoverLetterQuestionsField } from "./CoverLetterQuestionsField";
import type { CoverLetterQuestion } from "@/types/cover-letter";

function Harness({ initial }: { initial: CoverLetterQuestion[] }) {
  const [questions, setQuestions] = useState(initial);
  return (
    <div className="max-w-lg bg-surface p-4">
      <CoverLetterQuestionsField questions={questions} onChange={setQuestions} />
    </div>
  );
}

const meta: Meta<typeof CoverLetterQuestionsField> = {
  title: "features/export/CoverLetterQuestionsField",
  component: CoverLetterQuestionsField,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof CoverLetterQuestionsField>;

/** 처음 진입 — 빈 칸 하나. 삭제 버튼은 마지막 한 줄에는 뜨지 않는다. */
export const 빈_상태: Story = { render: () => <Harness initial={[{ question: "" }]} /> };

export const 문항_여러개: Story = {
  render: () => (
    <Harness
      initial={[
        { question: "지원 동기와 본인의 강점을 서술하시오.", maxChars: 1000 },
        { question: "입사 후 목표를 서술하시오.", maxChars: 500 },
        { question: "실패했던 경험과 배운 점을 서술하시오." },
      ]}
    />
  ),
};

/** 상한(10개)에 닿으면 '문항 추가'가 사라진다. */
export const 최대_문항: Story = {
  render: () => (
    <Harness
      initial={Array.from({ length: 10 }, (_, i) => ({ question: `문항 ${i + 1}` }))}
    />
  ),
};
