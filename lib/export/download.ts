// 생성한 문서를 파일로 떨어뜨리는 마지막 한 걸음.
// 브라우저 인쇄 대화상자와 달리 파일명을 우리가 정한다 — FRT-112 가 요구한 "파일명 규칙".

import type { ResumeLanguage } from "@/types/resume";

// 경로를 갈라놓거나 파일명에 쓸 수 없는 문자. 하이픈은 이름의 일부일 수 있어
// (Seo-yun) 남기고, 공백은 sanitizeName 에서 밑줄로 바꾼다.
const FORBIDDEN = /[\\/:*?"<>|]/g;
/** 이름 부분의 상한 — 전체 파일명이 OS 한계(255)에 닿지 않게 넉넉히 자른다. */
const MAX_NAME_LENGTH = 60;

function sanitizeName(raw: string | undefined): string {
  const cleaned = (raw ?? "")
    .replace(FORBIDDEN, "")
    .replace(/\s+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");

  return cleaned.slice(0, MAX_NAME_LENGTH);
}

function formatStamp(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export interface ResumeFileNameParams {
  name: string | undefined;
  language: ResumeLanguage;
  ext: "pdf" | "docx";
  /** 테스트에서 고정할 수 있도록 주입받는다. */
  now?: Date;
}

export function resumeFileName({
  name,
  language,
  ext,
  now = new Date(),
}: ResumeFileNameParams): string {
  const label = language === "en" ? "Resume" : "레쥬메";
  const owner = sanitizeName(name);
  const stem = owner ? `${owner}_${label}` : label;
  return `${stem}_${formatStamp(now)}.${ext}`;
}

/** Blob 을 사용자의 디스크로 내려보낸다. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    // 클릭은 동기적으로 다운로드를 시작하므로 바로 회수해도 안전하다.
    URL.revokeObjectURL(url);
  }
}
