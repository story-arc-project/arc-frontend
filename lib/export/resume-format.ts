// 레쥬메 화면 미리보기와 파일 내보내기(PDF·DOCX)가 함께 쓰는 표기 규칙.
// 미리보기 컴포넌트(`"use client"`)와 순수 문서 변환기 양쪽에서 import 하므로
// 여기에는 렌더러 의존이 없어야 한다.

/** 기간 표기. 원문이 있으면 그대로 쓰고, 진행 중이면 종료 자리를 "현재"로 닫는다. */
export function formatPeriod(
  start: string | null,
  end: string | null,
  raw?: string | null,
  ongoing?: boolean,
): string {
  if (raw && raw.trim()) return raw;
  const s = (start ?? "").trim();
  const e = ongoing ? "현재" : (end ?? "").trim();
  if (!s && !e) return "";
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}

/** 값이 있는 조각만 가운뎃점으로 잇는다. */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((v) => v && String(v).trim())
    .map((v) => String(v).trim())
    .join(" · ");
}

/** 빈 문자열·공백만 있는 항목을 걸러낸다. */
export function compactStrings(items: readonly string[] | null | undefined): string[] {
  return (items ?? []).filter((s) => s && s.trim()).map((s) => s.trim());
}
