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
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft(versionId: string, data: ResumeVersion): ResumeDraft {
  const draft: ResumeDraft = {
    data,
    updated_at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key(versionId), JSON.stringify(draft));
    } catch {
      // ignore quota errors
    }
  }
  return draft;
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
