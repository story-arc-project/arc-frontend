import { normalizeResumeVersion } from "@/lib/export/resume-normalize";
import type { ResumeVersion } from "@/types/resume";

const STORAGE_PREFIX = "arc:resume-draft:";

export interface ResumeDraft {
  data: ResumeVersion;
  updated_at: string;
}

function key(versionId: string): string {
  return `${STORAGE_PREFIX}${versionId}`;
}

export function readDraft(versionId: string): ResumeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(versionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeDraft;
    if (!parsed?.data || !parsed?.updated_at) return null;
    // 임시 저장은 레쥬메 본문이 들어오는 또 하나의 경계다. 링크 정규화 도입 이전에 저장된
    // draft 에는 백엔드가 준 문자열 링크가 그대로 들어 있을 수 있어, 여기서 정규화하지 않으면
    // 복원 시 getResume 의 정규화를 우회해 링크가 화면에서 사라진다.
    return { ...parsed, data: normalizeResumeVersion(parsed.data) };
  } catch {
    return null;
  }
}

export function writeDraft(versionId: string, data: ResumeVersion): boolean {
  const draft: ResumeDraft = {
    data,
    updated_at: new Date().toISOString(),
  };
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key(versionId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(versionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(versionId));
  } catch {
    // ignore
  }
}

export function isDraftNewer(
  draft: ResumeDraft,
  resume: ResumeVersion,
): boolean {
  const draftMs = Date.parse(draft.updated_at);
  const resumeMs = Date.parse(resume.meta.generated_at);
  if (Number.isNaN(draftMs)) return false;
  if (Number.isNaN(resumeMs)) return true;
  return draftMs > resumeMs;
}
