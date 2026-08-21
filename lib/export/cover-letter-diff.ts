// FRT-107: 자소서 초안의 어느 문항에 처음 손을 댔는가.
//
// 레쥬메의 resume_edited{section} 에 대응하는 값이다 — 레쥬메가 섹션 아코디언이라 "섹션",
// 자소서는 문항이 여럿(보통 3~5)이라 "문항 번호"다. 문항 **내용**은 PII 위험이라 절대
// 싣지 않으므로 번호만 낸다.
//
// ⚠️ 21차 회의에서 문장 단위 승인/기각 UX 자체가 폐기됐다(resume-diff.ts 주석 참고).
// 그래서 "얼마나 고쳐 쓰는가"는 자유 편집에서 무엇이 원본과 달라졌는가로만 잴 수 있다.
import type { CoverLetterResult } from "@/types/cover-letter";

/**
 * `current` 가 `baseline` 과 처음으로 달라지는 문항의 인덱스. 같으면 -1.
 *
 * 본문(cover_letter)만 본다 — 문항 제목·근거는 사용자가 고치는 대상이 아니다.
 * 길이가 달라졌다면(문항이 늘거나 줄었다면) 그 경계가 곧 첫 변화다.
 */
export function firstChangedAnswerIndex(
  current: CoverLetterResult | null,
  baseline: CoverLetterResult | null,
): number {
  if (!current || !baseline) return -1;
  const a = current.answers ?? [];
  const b = baseline.answers ?? [];
  const shorter = Math.min(a.length, b.length);
  for (let i = 0; i < shorter; i++) {
    if (a[i]?.cover_letter !== b[i]?.cover_letter) return i;
  }
  if (a.length !== b.length) return shorter;
  return -1;
}
