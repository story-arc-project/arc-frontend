import type { CoverLetterQuestion, CoverLetterResult } from "@/types/cover-letter";

/**
 * 생성할 때 입력한 **문항별 글자수 제한**을 이 기기에 남긴다.
 *
 * 왜 필요한가: 제한은 `QUESTIONS[].max_chars` 로 보내지만, 출력 `AnswerResult` 에는 그 값이
 * 없다(명세). 생성 폼은 제출 후 사라지므로 상세 화면은 제한을 알 길이 없고, 카운터가 글자수만
 * 보여주며 **사용자가 적어 넣은 요구 조건을 넘겨도 아무 말을 하지 않는다.**
 *
 * 서버가 실어 주기 시작하면(계약에 추가되면) 서버 값이 이깁니다 — 이 저장분은 폴백이다.
 * 그때 이 모듈은 사라져야 한다.
 */

const STORAGE_PREFIX = "arc:cover-letter-limits:";

interface StoredLimit {
  question: string;
  max_chars: number;
}

function key(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

export function writeLimits(id: string, questions: readonly CoverLetterQuestion[]): void {
  if (typeof window === "undefined") return;
  const limits: StoredLimit[] = questions
    .filter((q) => typeof q.maxChars === "number" && q.maxChars > 0)
    .map((q) => ({ question: q.question, max_chars: q.maxChars as number }));
  if (limits.length === 0) return;
  try {
    window.localStorage.setItem(key(id), JSON.stringify(limits));
  } catch {
    // 용량 초과·프라이빗 모드 — 제한 없이 글자수만 보여주는 현재 동작으로 떨어진다.
  }
}

export function readLimits(id: string): StoredLimit[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const limits = parsed.filter(
      (v): v is StoredLimit =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as StoredLimit).question === "string" &&
        typeof (v as StoredLimit).max_chars === "number" &&
        (v as StoredLimit).max_chars > 0,
    );
    return limits.length > 0 ? limits : null;
  } catch {
    return null;
  }
}

/**
 * 서버가 제한을 주지 않은 문항에만 저장분을 채운다.
 *
 * 문항 본문으로 짝지어야 한다 — 명세상 순서는 보존되지만 빈 문항이 "(자유 형식)" 으로
 * 대체되거나 서버가 자유 형식 1건을 만들어 개수가 어긋날 수 있어, 인덱스만 믿으면 **다른
 * 문항의 제한이 붙어 엉뚱한 초과 경고**가 뜬다.
 */
export function applyLimits(
  result: CoverLetterResult,
  limits: StoredLimit[] | null,
): CoverLetterResult {
  if (!limits || limits.length === 0) return result;

  const byQuestion = new Map(limits.map((l) => [l.question.trim(), l.max_chars]));
  let changed = false;

  const answers = result.answers.map((a) => {
    if (typeof a.max_chars === "number") return a; // 서버 값이 정본이다.
    const found = byQuestion.get(a.question.trim());
    if (found === undefined) return a;
    changed = true;
    return { ...a, max_chars: found };
  });

  return changed ? { ...result, answers } : result;
}
