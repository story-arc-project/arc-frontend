"use client";

import { useMemo } from "react";
import { Textarea } from "@/components/ui";
import { buildGroundingHighlight } from "@/lib/export/cover-letter-grounding";
import {
  hasUngroundedAnswer,
  isAllGrounded,
  type CoverLetterResult,
} from "@/types/cover-letter";
import { CoverLetterCollapsible } from "./CoverLetterCollapsible";
import { CoverLetterGroundingNotice } from "./CoverLetterGroundingNotice";
import { CoverLetterSummaryBadge } from "./CoverLetterSummaryBadge";

interface CoverLetterEditorPanelProps {
  result: CoverLetterResult;
  onChange: (next: CoverLetterResult) => void;
  /**
   * 서버가 만들어 준 원본. 문항 본문이 이것과 달라졌으면 그 문항의 검증 결과는 낡은 것이다
   * (명세의 "수정 시 해제"). 편집 중 상태로 판정하면 draft 복원 직후처럼 "고치지 않았는데
   * 고친 것"으로 보이므로 **원본과의 비교**로만 판단한다.
   */
  original?: CoverLetterResult;
}

function charCountLabel(body: string, maxChars?: number): string {
  const len = body.length;
  return maxChars ? `${len.toLocaleString()} / ${maxChars.toLocaleString()}자` : `${len.toLocaleString()}자`;
}

export function CoverLetterEditorPanel({
  result,
  onChange,
  original,
}: CoverLetterEditorPanelProps) {
  const metaBits = useMemo(() => {
    const bits: string[] = [];
    if (result.meta?.job_label) bits.push(result.meta.job_label);
    if (result.meta?.region === "US") bits.push("미국형");
    return bits;
  }, [result.meta]);

  // 검증 이후 본문이 바뀐 문항이 하나라도 있는지 — 요약 배지가 "확인됨"으로 남지 않게 한다.
  const anyEdited = useMemo(() => {
    if (!original) return false;
    return result.answers.some((a, i) => {
      const originalBody = original.answers[i]?.cover_letter;
      return originalBody !== undefined && originalBody !== a.cover_letter;
    });
  }, [result.answers, original]);

  const updateAnswer = (index: number, coverLetter: string) => {
    onChange({
      ...result,
      answers: result.answers.map((a, i) =>
        i === index ? { ...a, cover_letter: coverLetter } : a,
      ),
    });
  };

  return (
    <div className="space-y-4">
      {(metaBits.length > 0 || result.answers.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {/* 서버 meta 가 "전부 통과"라 해도 개별 문항에 경고가 살아 있으면 요약은 통과가
              아니다. 둘이 어긋날 때 낙관하는 쪽을 고르면, 아래에 빨간 경고가 떠 있는데도
              머리말은 "확인된 초안"이라고 말하는 화면이 된다 — 사용자가 믿는 건 머리말이다. */}
          <CoverLetterSummaryBadge
            allGrounded={isAllGrounded(result) && !hasUngroundedAnswer(result)}
            hasWarning={hasUngroundedAnswer(result)}
            stale={anyEdited}
          />
          {metaBits.map((bit) => (
            <span key={bit} className="text-caption text-text-tertiary">
              {bit}
            </span>
          ))}
        </div>
      )}

      {result.answers.map((answer, index) => {
        const originalBody = original?.answers[index]?.cover_letter;
        const edited =
          originalBody !== undefined && originalBody !== answer.cover_letter;
        // 하이라이트 위치는 원본 기준이라 편집 후엔 의미가 없다 — 편집한 문항은 계산을 건너뛰고
        // 모든 주장을 "위치 못 찾음"으로 넘겨 배너가 글로 보여주게 한다.
        const { unmatched } = edited
          ? { unmatched: answer.grounding.unsupported_claims }
          : buildGroundingHighlight(
              answer.cover_letter,
              answer.grounding.unsupported_claims,
            );
        const over =
          typeof answer.max_chars === "number" &&
          answer.cover_letter.length > answer.max_chars;

        return (
          <section
            key={`${index}-${answer.question}`}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-body-sm font-semibold text-text-primary">
                문항 {index + 1}
              </h3>
              <span
                className={[
                  "shrink-0 text-caption tabular-nums",
                  over ? "text-error" : "text-text-tertiary",
                ].join(" ")}
              >
                {charCountLabel(answer.cover_letter, answer.max_chars)}
              </span>
            </div>
            <p className="mt-0.5 text-body-sm text-text-secondary">{answer.question}</p>

            <div className="mt-3">
              <Textarea
                value={answer.cover_letter}
                onChange={(e) => updateAnswer(index, e.target.value)}
                aria-label={`문항 ${index + 1} 자기소개서 본문`}
                rows={8}
              />
            </div>

            <CoverLetterGroundingNotice
              grounding={answer.grounding}
              unmatchedClaims={unmatched}
              stale={edited}
            />

            {answer.writing_guide && (
              <div className="mt-3">
                <CoverLetterCollapsible title="작성 가이드">
                  <p className="whitespace-pre-wrap text-body-sm text-text-secondary">
                    {answer.writing_guide}
                  </p>
                </CoverLetterCollapsible>
              </div>
            )}
          </section>
        );
      })}

      {/* 부가 산출물 — 본문이 아니므로 읽기 전용이고 기본은 접혀 있다. */}
      {result.company_research && (
        <CoverLetterCollapsible title="회사 리서치" hint="검색 요약">
          <p className="whitespace-pre-wrap text-body-sm text-text-secondary">
            {result.company_research}
          </p>
        </CoverLetterCollapsible>
      )}

      {result.action_plan && (
        <CoverLetterCollapsible title="커리어 액션플랜">
          <p className="whitespace-pre-wrap text-body-sm text-text-secondary">
            {result.action_plan}
          </p>
        </CoverLetterCollapsible>
      )}
    </div>
  );
}
