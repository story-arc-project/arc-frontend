import { clearRaw, readRaw, writeRaw, type DraftTier } from "./draft-storage";
import { normalizeCoverLetter } from "./cover-letter-normalize";
import type { CoverLetterResult } from "@/types/cover-letter";

// 서버 저장(PATCH)이 아직 없어(BAC-62 미착수) 편집은 이 로컬 임시 저장이 유일한 보관처다.
// 레쥬메 resume-draft 와 같은 구조·같은 이유다.
// 어느 저장소에 어떻게 담기는지는 draft-storage 가 안다 — 여기는 자소서 스키마만 안다.

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
    const raw = readRaw(key(id));
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

/**
 * **반환값은 "저장됐다/아니다"가 아니라 "얼마나 오래 버티는가"다.**
 *
 * `"local"` 만 브라우저를 닫아도 남는다. `"session"`·`"memory"` 는 임시 보관이고 `null` 은
 * 아예 담지 못했다는 뜻이라, 호출부는 그 차이를 사용자에게 알려야 한다 — 조용히 넘기면
 * 사용자는 저장된 줄 알고 탭을 닫는다(FRT-261).
 */
export function writeDraft(id: string, data: CoverLetterResult): DraftTier | null {
  if (typeof window === "undefined") return null;
  const draft: CoverLetterDraft = { data, updated_at: new Date().toISOString() };
  try {
    return writeRaw(key(id), JSON.stringify(draft));
  } catch {
    // 직렬화 자체가 실패하는 경우(순환 참조 등) — 저장할 것이 없다.
    return null;
  }
}

export function clearDraft(id: string): void {
  if (typeof window === "undefined") return;
  clearRaw(key(id));
}

/**
 * 저장소에 지금 담긴 draft 가 `data` 와 **같은 본문**인가.
 *
 * `true` 는 호출부에서 `clearDraft` 로 이어진다. 탭이 숨겨질 때 담아 둔 스냅샷을 되돌려
 * 치울 때, 그 사이 다른 탭이 같은 키에 더 새 편집을 남겼으면 그것은 이 탭이 치울 것이
 * 아니다 — "내가 담았다"는 기억만으로는 저장소에 있는 것이 아직 내 것인지 알 수 없다.
 *
 * 정규화를 거치지 않고 원문을 그대로 비교한다. 같은 객체를 같은 직렬화로 썼으니 왕복한
 * 문자열이 같고, 정규화는 키 순서를 바꿀 수 있어 내 것도 남의 것으로 보이게 한다.
 */
export function isStoredDraft(id: string, data: CoverLetterResult): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = readRaw(key(id));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<CoverLetterDraft> | null;
    if (!parsed?.data) return false;
    return JSON.stringify(parsed.data) === JSON.stringify(data);
  } catch {
    return false;
  }
}

/**
 * 임시 저장이 서버 본문보다 새로운가.
 *
 * **false 는 "draft 를 버려도 된다"는 뜻이다** — 호출부가 그 신호로 `clearDraft` 를 부른다.
 * 그래서 판정 불가를 false 로 떨어뜨리면 사용자의 미저장 편집이 조용히 사라진다.
 *
 * 자소서는 서버가 생성 시각(`created_at`)만 준다 — 서버 쪽 편집 시각이 없다(저장 API 자체가
 * 없으니 당연하다). 그 `created_at` 마저 못 읽으면 비교가 성립하지 않으므로 **draft 를 살린다**
 * (`true` → 복원 배너 노출, 채택은 사용자 몫). 되돌릴 수 있는 배너 한 번이 되돌릴 수 없는
 * 삭제보다 낫다. `resume-draft.ts` 의 `isDraftNewer` 와 같은 방향이다.
 *
 * 반대로 draft 자신의 시각이 깨졌으면 그 draft 는 신뢰할 수 없으므로 false(정리 대상)로 둔다.
 */
export function isDraftNewer(draft: CoverLetterDraft, server: CoverLetterResult): boolean {
  const draftMs = Date.parse(draft.updated_at);
  if (Number.isNaN(draftMs)) return false;

  const serverMs = server.created_at ? Date.parse(server.created_at) : NaN;
  if (Number.isNaN(serverMs)) return true;

  return draftMs > serverMs;
}
