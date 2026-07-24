"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { CoverLetterQuestion } from "@/types/cover-letter";

interface CoverLetterQuestionsFieldProps {
  questions: CoverLetterQuestion[];
  onChange: (next: CoverLetterQuestion[]) => void;
}

const MAX_QUESTIONS = 10;

/**
 * 자소서 문항 입력. 회사 공고의 문항을 그대로 붙여넣는 자리다.
 *
 * 입력 허들을 낮추는 쪽으로 기운 설계다 — 문항을 비워도 막지 않는다(명세: 비우면 "(자유 형식)"
 * 으로 1건 생성). 글자수 제한도 선택이다. 사용자가 채워야 할 칸이 늘수록 시작을 미룬다.
 */
export function CoverLetterQuestionsField({
  questions,
  onChange,
}: CoverLetterQuestionsFieldProps) {
  const update = (index: number, patch: Partial<CoverLetterQuestion>) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const remove = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const add = () => {
    if (questions.length >= MAX_QUESTIONS) return;
    onChange([...questions, { question: "" }]);
  };

  return (
    <fieldset>
      <legend className="text-body-sm font-medium text-text-primary">문항</legend>
      <p className="mt-1 text-caption text-text-tertiary">
        공고의 문항을 그대로 붙여넣으세요. 비워 두면 자유 형식으로 만들어요.
      </p>

      <ul className="mt-3 space-y-2">
        {questions.map((q, index) => (
          <li key={index} className="flex items-start gap-2">
            <div className="flex-1 space-y-1.5">
              <input
                type="text"
                value={q.question}
                onChange={(e) => update(index, { question: e.target.value })}
                placeholder={`문항 ${index + 1} (예: 지원 동기를 서술하시오)`}
                aria-label={`문항 ${index + 1}`}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              />
              <label className="flex items-center gap-2 text-caption text-text-tertiary">
                글자수 제한
                <input
                  type="number"
                  min={100}
                  max={10000}
                  step={100}
                  value={q.maxChars ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = Number(raw);
                    // 빈 값 = 제한 없음(백엔드 기본 1000자). 0/음수는 제한으로 볼 수 없다.
                    update(index, {
                      maxChars:
                        raw === "" || !Number.isFinite(parsed) || parsed <= 0
                          ? undefined
                          : parsed,
                    });
                  }}
                  placeholder="선택"
                  aria-label={`문항 ${index + 1} 글자수 제한`}
                  className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-caption text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                />
                자
              </label>
            </div>
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`문항 ${index + 1} 삭제`}
                className="mt-2 rounded-md p-1.5 text-text-tertiary transition-colors hover:text-error"
              >
                <X size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {questions.length < MAX_QUESTIONS && (
        <Button variant="ghost" size="sm" onClick={add} className="mt-2">
          <Plus size={14} className="mr-1" />
          문항 추가
        </Button>
      )}
    </fieldset>
  );
}
