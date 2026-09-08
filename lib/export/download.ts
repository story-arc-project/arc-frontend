// 생성한 문서를 파일로 떨어뜨리는 마지막 한 걸음.
// 브라우저 인쇄 대화상자와 달리 파일명을 우리가 정한다 — FRT-112 가 요구한 "파일명 규칙".

import type { ResumeLanguage } from "@/types/resume";

// 경로를 갈라놓거나 파일명에 쓸 수 없는 문자. 하이픈은 이름의 일부일 수 있어
// (Seo-yun) 남기고, 공백은 sanitizeName 에서 밑줄로 바꾼다.
const FORBIDDEN = /[\\/:*?"<>|]/g;
// 제어·서식 문자(\p{C}). 파싱 결과에 섞여 들어오면 저장이 거부되거나 이름이 깨진다.
const INVISIBLE = /\p{C}/gu;
/** 이름 부분의 상한 — 전체 파일명이 OS 한계(255)에 닿지 않게 넉넉히 자른다. */
const MAX_NAME_LENGTH = 60;
/** blob URL 회수를 미루는 시간 — 브라우저가 다운로드를 집어들 여유. */
const REVOKE_DELAY_MS = 60_000;

function sanitizeName(raw: string | undefined): string {
  const cleaned = (raw ?? "")
    .replace(INVISIBLE, "")
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
  const label = language === "en" ? "Resume" : "이력서";
  const owner = sanitizeName(name);
  const stem = owner ? `${owner}_${label}` : label;
  return `${stem}_${formatStamp(now)}.${ext}`;
}

/** Blob 을 사용자의 디스크로 내려보낸다. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  // 일부 브라우저(Firefox 계열)는 문서에 붙어 있지 않은 앵커의 click 을 무시한다.
  // 붙였다 바로 떼면 화면에는 아무 흔적도 남지 않는다.
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // 클릭 직후 회수하면, blob URL 을 클릭 태스크 이후에 해석하는 브라우저에서
    // 큰 PDF·DOCX 다운로드가 취소되거나 빈 파일로 떨어진다. 한 박자 늦춰 회수한다.
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }
}
