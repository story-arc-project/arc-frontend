import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { CoverLetterEditorPanel } from "./CoverLetterEditorPanel";
import type { CoverLetterAnswer, CoverLetterResult } from "@/types/cover-letter";

// 백엔드(BAC-62)가 아직 없어 실데이터로 열어볼 수 없다. 이 스토리들이 유일한 시각 검증
// 경로이므로, 명세가 "조건부"라 표시한 값의 부재·빈값 조합을 모두 세워 둔다.

const BODY = `저는 학부 2학년 때 교내 데이터 분석 학회에 들어가면서 데이터를 다루기 시작했습니다.
처음 맡은 일은 설문 응답 3,000건을 정리하는 것이었고, 반복되는 전처리를 파이썬 스크립트로 바꾸어 작업 시간을 이틀에서 두 시간으로 줄였습니다.

이후 팀 프로젝트에서는 이탈률이 높은 구간을 찾는 분석을 맡았습니다. 3년간 팀장 경험을 살려 일정을 조율했고, 최종 발표에서 학회 우수상을 받았습니다.`;

function answer(overrides: Partial<CoverLetterAnswer> = {}): CoverLetterAnswer {
  return {
    question: "지원 동기와 본인의 강점을 서술하시오. (1,000자 이내)",
    cover_letter: BODY,
    grounding: { grounded: true, unsupported_claims: [], notes: "검증 통과 (교정 반복 0회)" },
    max_chars: 1000,
    ...overrides,
  };
}

const grounded: CoverLetterResult = {
  answers: [answer(), answer({ question: "입사 후 목표를 서술하시오.", max_chars: 500 })],
  meta: { job_label: "데이터 분석/사이언스", region: "KR", all_grounded: true },
  company_research: "고객 신뢰를 최우선 가치로 두며, 자율과 책임을 강조하는 문화입니다.",
  action_plan: "단기: SQL 심화 · 중기: 도메인 지식 · 장기: 데이터 프로덕트 기획",
};

const ungrounded: CoverLetterResult = {
  answers: [
    answer({
      grounding: {
        grounded: false,
        // 하나는 본문에 그대로 있고(하이라이트됨), 하나는 없다(배너에만 뜸).
        unsupported_claims: ["3년간 팀장 경험을 살려", "전국 대회 대상을 수상했습니다"],
        notes: "근거 없는 주장 2건 발견 (교정 반복 2회)",
      },
      writing_guide:
        "전략: 두괄식으로 시작하세요.\n\n문단별 해설\n1문단 — 계기를 사실로 시작합니다.\n\n예상 면접 질문\n1. 전처리 자동화의 구체적 방법은?",
    }),
  ],
  meta: { job_label: "데이터 분석/사이언스", region: "KR", all_grounded: false },
};

/** 검증 자체가 실패한 경우 — claims 는 비어 있지만 통과도 아니다(명세: 파싱 실패 시에도 false). */
const verificationFailed: CoverLetterResult = {
  answers: [
    answer({
      grounding: { grounded: false, unsupported_claims: [], notes: "검증 응답 파싱 실패" },
    }),
  ],
};

/** meta·작성 가이드·리서치·액션플랜이 전부 없는 최소 응답. 화면이 버텨야 한다. */
const minimal: CoverLetterResult = {
  answers: [
    {
      question: "(자유 형식)",
      cover_letter: "짧은 초안입니다.",
      grounding: { grounded: true, unsupported_claims: [], notes: "" },
    },
  ],
};

function Harness({ initial }: { initial: CoverLetterResult }) {
  const [result, setResult] = useState(initial);
  return (
    <div className="max-w-xl bg-surface p-4">
      <CoverLetterEditorPanel result={result} onChange={setResult} original={initial} />
    </div>
  );
}

const meta: Meta<typeof CoverLetterEditorPanel> = {
  title: "features/export/CoverLetterEditorPanel",
  component: CoverLetterEditorPanel,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof CoverLetterEditorPanel>;

export const 근거_확인됨: Story = { render: () => <Harness initial={grounded} /> };

export const 근거_없는_주장: Story = { render: () => <Harness initial={ungrounded} /> };

export const 검증_실패: Story = { render: () => <Harness initial={verificationFailed} /> };

export const 최소_응답_meta_부재: Story = { render: () => <Harness initial={minimal} /> };

/** 글자수 제한을 넘긴 상태 — 카운터가 경고색이어야 한다. */
export const 글자수_초과: Story = {
  render: () => (
    <Harness
      initial={{
        answers: [answer({ cover_letter: BODY.repeat(3), max_chars: 500 })],
      }}
    />
  ),
};

/**
 * 사용자가 본문을 고친 뒤. 검증 결과가 낡았으므로 하이라이트는 꺼지고,
 * 경고는 남되 "다시 검증하지 않았다"는 안내가 붙어야 한다.
 */
export const 편집_후_검증_낡음: Story = {
  render: () => {
    const original = ungrounded;
    const edited: CoverLetterResult = {
      ...original,
      answers: [{ ...original.answers[0], cover_letter: "사용자가 고쳐 쓴 본문입니다." }],
    };
    return (
      <div className="max-w-xl bg-surface p-4">
        <CoverLetterEditorPanel result={edited} onChange={() => {}} original={original} />
      </div>
    );
  },
};
