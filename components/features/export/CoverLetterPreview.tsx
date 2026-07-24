"use client";

import { buildGroundingHighlight } from "@/lib/export/cover-letter-grounding";
import type { CoverLetterAnswer, CoverLetterResult } from "@/types/cover-letter";

interface CoverLetterPreviewProps {
  result: CoverLetterResult;
  /** 원본(서버 생성본). 본문이 달라진 문항은 하이라이트를 끈다 — 위치가 낡았기 때문이다. */
  original?: CoverLetterResult;
}

/**
 * 제출할 모습 그대로 읽는 면. 편집 패널이 "고치는 곳"이라면 여기는 "확인하는 곳"이다.
 *
 * 근거 없는 주장은 본문 위에 직접 표시한다(명세: "본문에서 부분 매칭해 하이라이트").
 * 색만으로 알리지 않는다 — 밑줄과 `title`/스크린리더 텍스트를 함께 둔다.
 */
export function CoverLetterPreview({ result, original }: CoverLetterPreviewProps) {
  if (result.answers.length === 0) {
    return (
      <p className="text-body-sm text-text-tertiary">보여줄 자기소개서 본문이 없어요.</p>
    );
  }

  return (
    <article className="mx-auto max-w-2xl space-y-8">
      {result.answers.map((answer, index) => {
        const originalBody = original?.answers[index]?.cover_letter;
        const edited = originalBody !== undefined && originalBody !== answer.cover_letter;
        return (
          <AnswerBlock
            key={`${index}-${answer.question}`}
            answer={answer}
            index={index}
            highlight={!edited}
          />
        );
      })}
    </article>
  );
}

function AnswerBlock({
  answer,
  index,
  highlight,
}: {
  answer: CoverLetterAnswer;
  index: number;
  highlight: boolean;
}) {
  const over =
    typeof answer.max_chars === "number" && answer.cover_letter.length > answer.max_chars;

  return (
    <section>
      <header className="border-b border-border pb-2">
        <h3 className="text-body-sm font-semibold text-text-primary">
          <span className="text-text-tertiary">{index + 1}.</span> {answer.question}
        </h3>
      </header>

      {/* 문단은 본문의 개행이 정본이다(명세: "문단은 개행(\n) 구분"). 개행으로 잘라 <p> 를
          만들지 않고 `whitespace-pre-wrap` 으로 살린다 — 잘라 두면 **줄을 걸친 주장이
          어느 조각에도 온전히 들어가지 않아 하이라이트가 통째로 빠진다.** 편집 패널은 본문
          전체로 매칭하므로, 자르는 순간 두 화면의 판정이 갈린다. */}
      <div className="mt-3 whitespace-pre-wrap text-body leading-relaxed text-text-primary">
        {highlight ? (
          <HighlightedBody
            text={answer.cover_letter}
            claims={answer.grounding.unsupported_claims}
          />
        ) : (
          answer.cover_letter
        )}
      </div>

      <p
        className={[
          "mt-3 text-caption tabular-nums",
          over ? "text-error" : "text-text-tertiary",
        ].join(" ")}
      >
        {answer.cover_letter.length.toLocaleString()}자
        {answer.max_chars ? ` / ${answer.max_chars.toLocaleString()}자` : ""}
        {over ? " — 제한을 넘었어요" : ""}
      </p>
    </section>
  );
}

function HighlightedBody({
  text,
  claims,
}: {
  text: string;
  claims: readonly string[];
}) {
  const { segments } = buildGroundingHighlight(text, claims);
  if (segments.length === 0) return <>{text}</>;

  return (
    <>
      {segments.map((seg, i) =>
        seg.flagged ? (
          <mark
            key={i}
            // 색만으로 구분하지 않는다 — 밑줄이 색각 이상·흑백 인쇄에서도 남는다.
            className="bg-error/10 text-text-primary underline decoration-error decoration-wavy underline-offset-4"
            title="내 기록에서 근거를 찾지 못한 문장이에요"
          >
            {seg.text}
            <span className="sr-only"> (근거를 찾지 못한 문장)</span>
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
