import { normalizeCoverLetter } from "./cover-letter-normalize";
import type { CoverLetterResult } from "@/types/cover-letter";

// 서버 저장(PATCH)이 아직 없어(BAC-62 미착수) 편집은 이 로컬 임시 저장이 유일한 보관처다.
// 레쥬메 resume-draft 와 같은 구조·같은 이유다.

const STORAGE_PREFIX = "arc:cover-letter-draft:";

export interface CoverLetterDraft {
  data: CoverLetterResult;
  updated_at: string;
}

function key(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

export function readDraft(id: string): CoverLetterDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoverLetterDraft;
    if (!parsed?.data || !parsed?.updated_at) return null;
    // 임시 저장도 본문이 들어오는 하나의 경계다 — 서버 경로와 같은 정규화를 태우지 않으면
    // 낡은 스키마의 draft 가 방어를 우회해 화면을 깨뜨린다(resume-draft 교훈).
    return { ...parsed, data: normalizeCoverLetter(parsed.data) };
  } catch {
    return null;
  }
}

export function writeDraft(id: string, data: CoverLetterResult): boolean {
  if (typeof window === "undefined") return false;
  const draft: CoverLetterDraft = { data, updated_at: new Date().toISOString() };
  try {
    window.localStorage.setItem(key(id), JSON.stringify(draft));
    return true;
  } catch {
    // 용량 초과·프라이빗 모드 — 호출부가 "저장 실패"를 사용자에게 알려야 한다.
    return false;
  }
}

export function clearDraft(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    // ignore
  }
}

/**
 * 임시 저장이 서버 본문보다 새로운가.
 *
 * 자소서는 서버가 생성 시각(`created_at`)만 준다 — 서버 쪽 편집 시각이 없다(저장 API 자체가
 * 없으니 당연하다). 비교 기준을 못 읽으면 **draft 를 우선하지 않는다**: 확실하지 않을 때
 * 사용자가 보고 있던 서버 본문을 임의로 덮어쓰는 쪽이 더 나쁜 실패다. 대신 draft 는 지우지
 * 않으므로(호출부가 clearDraft 를 부를 때만 사라진다) 편집이 유실되지는 않는다.
 */
export function isDraftNewer(draft: CoverLetterDraft, server: CoverLetterResult): boolean {
  const draftMs = Date.parse(draft.updated_at);
  if (Number.isNaN(draftMs)) return false;

  const serverMs = server.created_at ? Date.parse(server.created_at) : NaN;
  if (Number.isNaN(serverMs)) return false;

  return draftMs > serverMs;
}
