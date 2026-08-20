import { clearRaw, readRaw, writeRaw, type DraftTier } from "@/lib/export/draft-storage";
import { normalizeResumeVersion } from "@/lib/export/resume-normalize";
import type { ResumeVersion } from "@/types/resume";

// 어느 저장소에 어떻게 담기는지는 draft-storage 가 안다 — 여기는 레쥬메 스키마만 안다.
// 자소서 cover-letter-draft 와 같은 구조·같은 이유다.

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
    const raw = readRaw(key(versionId));
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

/**
 * **반환값은 "저장됐다/아니다"가 아니라 "얼마나 오래 버티는가"다.**
 *
 * `"local"` 만 브라우저를 닫아도 남는다. `"session"`·`"memory"` 는 임시 보관이고 `null` 은
 * 아예 담지 못했다는 뜻이라, 호출부는 그 차이를 사용자에게 알려야 한다(FRT-261).
 */
export function writeDraft(versionId: string, data: ResumeVersion): DraftTier | null {
  const draft: ResumeDraft = {
    data,
    updated_at: new Date().toISOString(),
  };
  if (typeof window === "undefined") return null;
  try {
    return writeRaw(key(versionId), JSON.stringify(draft));
  } catch {
    // 직렬화 자체가 실패하는 경우(순환 참조 등) — 저장할 것이 없다.
    return null;
  }
}

export function clearDraft(versionId: string): void {
  if (typeof window === "undefined") return;
  clearRaw(key(versionId));
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
