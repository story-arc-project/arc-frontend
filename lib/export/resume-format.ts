// 레쥬메 화면 미리보기와 파일 내보내기(PDF·DOCX)가 함께 쓰는 표기 규칙.
// 미리보기 컴포넌트(`"use client"`)와 순수 문서 변환기 양쪽에서 import 하므로
// 여기에는 렌더러 의존이 없어야 한다.

import type { Education } from "@/types/resume";

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

// 학력은 "재직중" 같은 플래그 대신 졸업구분으로 진행 상태를 나타내 기간 규칙이 다르다.
export function formatEducationPeriod(edu: Education): string {
  const start = edu.입학년월 ?? "";
  // 백엔드가 내는 값은 "재학"이 아니라 "재학중"이다(resume.py _SYS_KO). 이 비교가 어긋나 있어
  // 졸업년월이 없는 재학생의 학력 기간이 입학년월만 찍혀 나왔다(FRT-109에서 발견).
  //
  // 구 값 "재학"도 계속 받는다 — 선택지에서 뺐을 뿐 그때 사용자가 고른 레코드는 남아 있고,
  // 새 값만 인정하면 그 레코드의 기간이 "2021-03 – 재학"에서 "2021-03"으로 줄어든다.
  // (편집기는 EditorSelect 가 옵션 밖 값을 보존해 이미 안전하다 — 이 경로만 뚫려 있었다.)
  const status: string = edu.졸업구분 ?? "";
  const ongoing = status === "재학중" || status === "재학";
  const end = edu.졸업년월 ?? (ongoing ? status : "");
  return formatPeriod(start, end);
}

/** 학점 표기 — 만점을 알면 "3.72 / 4.5", 모르면 학점만. */
export function formatGpa(edu: Education): string | null {
  if (edu.학점 === null || edu.학점 === undefined) return null;
  if (edu.만점 === null || edu.만점 === undefined) return `${edu.학점}`;
  return `${edu.학점} / ${edu.만점}`;
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
