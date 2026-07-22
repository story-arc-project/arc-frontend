import type { PersonalInfo, PersonalInfoLink, ResumeVersion } from "@/types/resume";

/**
 * 백엔드 실값과 프런트 내부 shape 이 어긋나는 지점을 흡수한다.
 *
 * 인적사항.링크 — ai_analyst/src/ai/resume.py 의 `_SYS_KO` 스키마는 링크를 **문자열 배열**로
 * 내는데(EN 의 other_links 도 동일), 프런트는 { label, url } 객체 배열을 기대한다. 정규화가
 * 없으면 PreviewPersonalInfo 의 `l?.url?.trim()` 필터에 전부 걸려 링크가 통째로 사라지고,
 * PersonalInfoEditor 는 url 이 undefined 인 빈 행을 그린다. 소비처(프리뷰·편집기·PDF/Word)를
 * 건드리지 않도록 객체 shape 을 정본으로 두고 문자열만 승격한다. 이미 객체로 오는 백엔드도
 * 그대로 통과시킨다(형제 언랩과 같은 dual-compat).
 *
 * ⚠️ 레쥬메 본문이 들어오는 **모든 경계**가 이걸 통과해야 한다 — 서버 응답(getResume·
 * updateResume)뿐 아니라 localStorage 임시 저장(readDraft)도 마찬가지다. 이 변경 이전에
 * 저장된 draft 에는 정규화되지 않은 문자열 링크가 그대로 들어 있을 수 있고, 그 draft 를
 * 복원하면 정규화를 우회해 같은 증상이 되살아난다.
 */
/**
 * 인적사항이 통째로 빠진 본문을 위한 빈 값. 프리뷰는 isEmptySection 으로 그대로 숨기므로
 * 화면에 새 섹션이 생기지는 않는다. 레쥬메마다 새 객체를 만든다 — 하나를 공유하면 배열이
 * 여러 레쥬메에 물린다.
 */
function emptyPersonalInfo(): PersonalInfo {
  return {
    이름: null,
    영문명: null,
    생년월일: null,
    이메일: null,
    전화번호: null,
    주소: null,
    링크: [],
  };
}

export function normalizeResumeVersion(resume: ResumeVersion): ResumeVersion {
  const personal = resume.인적사항;
  // 인적사항 자체가 없는 본문도 unwrapResumeVersion 을 통과한다(그쪽은 meta 만 본다).
  // 그대로 두면 PersonalInfoEditor 가 undefined.이름 에서 던져 편집 화면이 통째로 죽는다 —
  // 링크만 챙기고 상위 부재를 흘려보내면 이 함수가 막으려던 실패가 한 겹 위에 남는다.
  if (personal === null || typeof personal !== "object") {
    return { ...resume, 인적사항: emptyPersonalInfo() };
  }
  return { ...resume, 인적사항: { ...personal, 링크: normalizeLinks(personal.링크) } };
}

function normalizeLinks(raw: unknown): PersonalInfoLink[] {
  if (!Array.isArray(raw)) return [];
  const links: PersonalInfoLink[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const url = item.trim();
      // 공백뿐인 문자열은 링크가 아니다 — 편집기에 빈 행으로 남기지 않는다.
      if (url !== "") links.push({ label: null, url });
      continue;
    }
    if (item !== null && typeof item === "object") links.push(item as PersonalInfoLink);
  }
  return links;
}
