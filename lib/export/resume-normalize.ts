import type {
  Activity,
  AdditionalInfo,
  Career,
  Club,
  PersonalInfo,
  PersonalInfoLink,
  Project,
  ResumeVersion,
  Skills,
} from "@/types/resume";

import { mapEnglishResume } from "./resume-en-mapping";
import { compactStrings } from "./resume-format";

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

/**
 * FRT-157 — 항목 안의 배열 필드를 채운다.
 *
 * `types/resume.ts` 는 경력.성과·대외활동.활동내용 같은 필드를 **필수 `string[]`** 로
 * 선언하지만, 그 선언은 런타임 보증이 아니다 — `unwrapResumeVersion` 이 백엔드 JSON 을
 * 검증 없이 `as ResumeVersion` 으로 캐스팅하므로, 필드가 없거나 null 로 오면 선언이
 * 거짓이 되고 프리뷰의 `a.성과.length` 가 TypeError 로 화면을 통째로 날린다.
 *
 * 여기서 한 번 채워 두면 프리뷰·편집기·문서 IR 세 소비처가 각자 방어하지 않아도 된다.
 * 규칙은 파일 내보내기(`resume-document.ts` 의 `bulletGroup`)가 쓰는 `compactStrings` 를
 * 그대로 빌려 화면과 파일이 같은 판정을 갖게 한다.
 *
 * ⚠️ 백엔드 스키마에 **새 필수 배열 필드가 생기면 여기도 같이 고쳐야 한다** — 이 함수는
 * 스키마를 검증하는 게 아니라 아는 필드를 사후에 채우는 것이라, 빠뜨리면 같은 계열
 * 크래시가 그 필드에서 되살아난다.
 */
function normalizeItems<T>(items: T[] | null | undefined, fix: (item: T) => T): T[] {
  // 다운스트림(visibleUsableExperiences·isEmptySection)은 배열 부재에 이미 안전하지만,
  // 이 함수는 곧장 map 을 걸므로 여기서부터 막아야 한다.
  return (items ?? []).map(fix);
}

function normalizeCareer(item: Career): Career {
  return {
    ...item,
    담당업무: compactStrings(item.담당업무),
    성과: compactStrings(item.성과),
  };
}

function normalizeActivity(item: Activity): Activity {
  return {
    ...item,
    활동내용: compactStrings(item.활동내용),
    성과: compactStrings(item.성과),
  };
}

function normalizeProject(item: Project): Project {
  return {
    ...item,
    사용기술: compactStrings(item.사용기술),
    내용: compactStrings(item.내용),
    성과: compactStrings(item.성과),
  };
}

function normalizeClub(item: Club): Club {
  return { ...item, 활동내용: compactStrings(item.활동내용) };
}

/** 배열이 아니라 단일 객체다 — 컨테이너 자체가 없을 수 있어 옵셔널 체이닝으로 받는다. */
function normalizeSkills(skills: Skills | null | undefined): Skills {
  return {
    기술스택: compactStrings(skills?.기술스택),
    툴: compactStrings(skills?.툴),
    소프트스킬: compactStrings(skills?.소프트스킬),
  };
}

function normalizeAdditionalInfo(info: AdditionalInfo): AdditionalInfo {
  return { ...info, 관심사: compactStrings(info.관심사) };
}

export function normalizeResumeVersion(resume: ResumeVersion): ResumeVersion {
  // FRT-147 — 영문 응답은 국문과 완전히 다른 키 한 벌로 온다. 여기서 한 번 옮겨 두면
  // 프리뷰·편집기·문서 IR 세 벌을 언어별로 분기시키지 않아도 된다. 이미 옮겨진 본문
  // (=draft 복원)은 영문 고유 키가 없어 그대로 통과한다 — 멱등이라 draft 왕복이 안전하다.
  const source = mapEnglishResume(resume) ?? resume;

  const personal = source.인적사항;
  // 인적사항 자체가 없는 본문도 unwrapResumeVersion 을 통과한다(그쪽은 meta 만 본다).
  // 그대로 두면 PersonalInfoEditor 가 undefined.이름 에서 던져 편집 화면이 통째로 죽는다 —
  // 링크만 챙기고 상위 부재를 흘려보내면 이 함수가 막으려던 실패가 한 겹 위에 남는다.
  const 인적사항: PersonalInfo =
    personal === null || typeof personal !== "object"
      ? emptyPersonalInfo()
      : { ...personal, 링크: normalizeLinks(personal.링크) };

  return {
    ...source,
    인적사항,
    경력: normalizeItems(source.경력, normalizeCareer),
    대외활동: normalizeItems(source.대외활동, normalizeActivity),
    프로젝트: normalizeItems(source.프로젝트, normalizeProject),
    동아리_학회: normalizeItems(source.동아리_학회, normalizeClub),
    기술및역량: normalizeSkills(source.기술및역량),
    // 상세 페이지의 파싱경고 배너도 같은 무방비 접근을 한다. 하필 이 배너는 본문을
    // 못 읽었을 때 뜨는 자리라, 부실한 응답일수록 이 필드까지 빠져 있을 법하다.
    파싱경고: compactStrings(source.파싱경고),
    // 원래 없던 섹션은 만들지 않는다 — 부재와 빈 값은 화면에서 다른 뜻이다.
    ...(source.기타정보 ? { 기타정보: normalizeAdditionalInfo(source.기타정보) } : {}),
  };
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
