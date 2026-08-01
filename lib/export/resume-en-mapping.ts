import type {
  Activity,
  AdditionalInfo,
  Award,
  Career,
  Certification,
  Education,
  LanguageItem,
  Linkage,
  PersonalInfoLink,
  Project,
  Publication,
  ResumeVersion,
} from "@/types/resume";

/**
 * FRT-147 — 영문 레쥬메 응답을 내부 형태(국문 키)로 옮긴다.
 *
 * 백엔드 생성기(`ai_analyst/src/ai/resume.py`)는 언어에 따라 **완전히 다른 스키마 한 벌**을 낸다.
 * 영문은 `contact`/`work_experience`/`education`… 이고 프런트는 국문 키만 안다. 그래서 지금은
 * 모든 섹션이 `undefined` → `isEmptySection` 전부 참 → 상세 화면이 `EmptyResumeState` 로 빠진다.
 * 크래시가 아니라 **조용한 빈 화면**이라 에러 로그에도 안 잡힌다.
 *
 * 렌더러·편집기·문서 IR 세 벌을 언어별로 분기시키는 대신 **경계에서 한 번 매핑**한다 —
 * 섹션 제목만 `resume-labels` 가 언어별로 바꾼다.
 *
 * ⚠️ 두 가지가 이 파일의 생명줄이다.
 *  1. **멱등성** — 이 경계는 서버 응답뿐 아니라 localStorage draft(`readDraft`)도 통과한다.
 *     매핑된 결과는 국문 키를 갖지만 `meta.language` 는 여전히 "en" 이므로, 언어로 분기했다면
 *     두 번째 호출이 `contact` 를 못 찾아 **전 섹션을 날린다**. 판정 근거는 언어가 아니라
 *     **영문 고유 키의 존재**다.
 *  2. **원문 보존** — 영문 CV 에 "학사"·"정규직"이 찍히면 안 된다. 국문 enum 으로 번역하지 않고
 *     영문 원문을 그대로 통과시킨다(`OrRawString`).
 */

/** 이 키가 하나라도 있으면 아직 매핑되지 않은 영문 응답이다. 국문 스키마에는 없는 이름들이다. */
const EN_MARKER_KEYS = [
  "contact",
  "work_experience",
  "education",
  "projects",
  "activities",
  "certifications",
  "awards",
  "publications",
  "parse_warnings",
] as const;

export function mapEnglishResume(raw: unknown): ResumeVersion | null {
  if (!isRecord(raw)) return null;
  if (!EN_MARKER_KEYS.some((key) => raw[key] !== undefined)) return null;

  const contact = record(raw.contact);
  const skills = record(raw.skills);

  return {
    ...(str(raw.version_id) !== null ? { version_id: str(raw.version_id) as string } : {}),
    meta: mapMeta(raw.meta),
    인적사항: {
      // 영문 레쥬메의 큰 이름은 영문명이다. 국문명은 부제로 내려간다.
      이름: str(contact.name),
      영문명: str(contact.name_ko),
      생년월일: null,
      이메일: str(contact.email),
      전화번호: str(contact.phone),
      주소: str(contact.location),
      링크: mapLinks(contact),
    },
    자기소개_요약: str(raw.summary),
    학력: list(raw.education).map(mapEducation),
    경력: list(raw.work_experience).map(mapCareer),
    프로젝트: list(raw.projects).map(mapProject),
    대외활동: list(raw.activities).map(mapActivity),
    // 영문 스키마에 동아리·학회는 없다 — activities 로 흡수된다(rev.5 명세).
    동아리_학회: [],
    수상: list(raw.awards).map(mapAward),
    자격증: list(raw.certifications).map(mapCertification),
    어학: mapLanguages(raw.languages, skills.languages),
    기술및역량: {
      기술스택: strList(skills.technical),
      툴: strList(skills.tools),
      // languages 는 어학 섹션이 정본이다 — 여기 남기면 같은 정보가 두 번 나온다.
      소프트스킬: strList(skills.soft_skills),
    },
    논문: list(raw.publications).map(mapPublication),
    연계성: list(raw.connections).map(mapLinkage),
    파싱경고: strList(raw.parse_warnings),
    ...mapAdditionalInfo(raw.additional_info),
  };
}

// ─── 섹션별 매핑 ─────────────────────────────────────────────────────

function mapMeta(raw: unknown): ResumeVersion["meta"] {
  const meta = record(raw);
  return {
    ...meta,
    language: "en",
    format: str(meta.format) ?? "western_resume",
    generated_at: str(meta.generated_at) ?? "",
    source_chars: num(meta.source_chars) ?? 0,
  } as ResumeVersion["meta"];
}

/** linkedin·github·portfolio 는 개별 필드로 오고 나머지는 other_links 에 담겨 온다. */
function mapLinks(contact: Record<string, unknown>): PersonalInfoLink[] {
  const links: PersonalInfoLink[] = [];
  for (const key of ["linkedin", "github", "portfolio"] as const) {
    const url = str(contact[key]);
    if (url !== null) links.push({ label: null, url });
  }
  for (const item of list(contact.other_links)) {
    const url = typeof item === "string" ? item.trim() : str(record(item).url);
    if (url) links.push({ label: null, url });
  }
  return links;
}

function mapEducation(raw: unknown, index: number): Education {
  const e = record(raw);
  return {
    id: num(e.id) ?? index + 1,
    학교명: str(e.institution),
    학과: str(e.field_of_study),
    전공구분: null,
    학위: str(e.degree),
    입학년월: str(e.start_date),
    졸업년월: str(e.end_date),
    졸업구분: str(e.status),
    학점: num(e.gpa),
    만점: num(e.gpa_scale),
    // 국문 스키마에 자리가 없는 영문 전용 값(부전공·우등·주요과목)은 버리지 않고 비고로 모은다.
    비고: joinNonEmpty([
      str(e.notes),
      prefixed("Minor", str(e.minor)),
      prefixed("Honors", str(e.honors)),
      prefixed("Coursework", strList(e.relevant_coursework).join(", ") || null),
    ]),
  };
}

function mapCareer(raw: unknown, index: number): Career {
  const c = record(raw);
  return {
    id: num(c.id) ?? index + 1,
    회사명: str(c.company),
    // rev.5 명세의 "기관명 | 도시" 표기 — 부서 자리에 도시가 온다.
    부서: str(c.location),
    직위: str(c.title),
    고용형태: str(c.employment_type),
    입사년월: str(c.start_date),
    퇴사년월: str(c.end_date),
    재직중: bool(c.is_current),
    담당업무: strList(c.responsibilities),
    성과: strList(c.achievements),
    ...displayControl(c),
  };
}

function mapProject(raw: unknown, index: number): Project {
  const p = record(raw);
  return {
    id: num(p.id) ?? index + 1,
    프로젝트명: str(p.name),
    소속기관: str(p.organization),
    기간_시작: str(p.start_date),
    기간_종료: str(p.end_date),
    기간_원문: null,
    역할: str(p.role),
    사용기술: strList(p.tech_stack),
    내용: strList(p.description),
    성과: strList(p.outcomes),
    ...displayControl(p),
  };
}

function mapActivity(raw: unknown, index: number): Activity {
  const a = record(raw);
  return {
    id: num(a.id) ?? index + 1,
    // 영문 activities 에는 활동명에 해당하는 필드가 없다 — 단체명이 곧 제목 역할을 한다.
    활동명: str(a.organization),
    기관: null,
    기간_시작: str(a.start_date),
    기간_종료: str(a.end_date),
    기간_원문: str(a.date_raw),
    진행중: bool(a.is_ongoing),
    역할: joinNonEmpty([str(a.role), str(a.type)]),
    활동내용: strList(a.description),
    성과: strList(a.achievements),
    ...displayControl(a),
  };
}

function mapAward(raw: unknown, index: number): Award {
  const a = record(raw);
  return {
    id: num(a.id) ?? index + 1,
    수상명: str(a.title),
    수여기관: str(a.issuer),
    수상년월: str(a.date),
    내용: str(a.description),
  };
}

function mapCertification(raw: unknown, index: number): Certification {
  const c = record(raw);
  return {
    id: num(c.id) ?? index + 1,
    자격증명: str(c.name),
    발급기관: str(c.issuer),
    취득년월: str(c.date),
    자격구분: str(c.type),
  };
}

function mapPublication(raw: unknown, index: number): Publication {
  const p = record(raw);
  return {
    id: num(p.id) ?? index + 1,
    제목: str(p.title),
    게재처: str(p.venue),
    발표년월: str(p.date),
    내용: str(p.description),
  };
}

function mapLinkage(raw: unknown): Linkage {
  const c = record(raw);
  return {
    항목ids: list(c.item_ids).filter((v): v is number => typeof v === "number"),
    연결점: str(c.note),
  };
}

/**
 * 어학은 두 벌로 올 수 있다. rev.5 는 최상위 `languages[]{language, proficiency, test, score, date}`,
 * 현행 백엔드는 `skills.languages` 문자열 배열("English (TOEFL 115)")이다. 둘 다 받는다.
 */
function mapLanguages(top: unknown, fromSkills: unknown): LanguageItem[] {
  const rev5 = list(top);
  if (rev5.length > 0) {
    return rev5.map((raw, index) => {
      const l = record(raw);
      return {
        id: num(l.id) ?? index + 1,
        언어: str(l.language),
        능통도: str(l.proficiency),
        시험명: str(l.test),
        점수등급: str(l.score),
        취득년월: str(l.date),
      };
    });
  }
  return strList(fromSkills).map((label, index) => ({
    id: index + 1,
    언어: label,
    능통도: null,
    시험명: null,
    점수등급: null,
    취득년월: null,
  }));
}

/** rev.5 전용. 없으면 키 자체를 만들지 않는다 — 빈 객체를 넣으면 빈 섹션이 생긴다. */
function mapAdditionalInfo(raw: unknown): { 기타정보?: AdditionalInfo } {
  if (!isRecord(raw)) return {};
  return {
    기타정보: {
      병역: str(raw.military),
      관심사: strList(raw.interests),
    },
  };
}

/** rev.5 표시 제어. 없으면 키를 만들지 않아 `visibleExperiences` 의 "미태그" 분기를 타게 한다. */
function displayControl(raw: Record<string, unknown>): {
  표시?: boolean;
  표시순위?: number | null;
} {
  // ⚠️ `undefined` 만 걸러서는 부족하다 — optional 을 `null` 로 직렬화하는 건 흔한 모양이고,
  // `bool(null)` 은 false 다. 그러면 태그되지 않은 경험이 **명시적으로 뺀 경험**으로 둔갑해
  // 미리보기·PDF·Word 에서 통째로 사라진다. `visibleExperiences` 의 하위호환 규칙은
  // "명시적 false 만 숨긴다" 이므로, 값이 **진짜 boolean 일 때만** 태그로 인정한다.
  if (typeof raw.display !== "boolean") return {};
  return { 표시: raw.display, 표시순위: num(raw.display_rank) };
}

// ─── 방어 파싱 ───────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function strList(value: unknown): string[] {
  return list(value)
    .map((item) => str(item))
    .filter((item): item is string => item !== null);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function prefixed(label: string, value: string | null): string | null {
  return value === null ? null : `${label}: ${value}`;
}

function joinNonEmpty(parts: (string | null)[]): string | null {
  const kept = parts.filter((part): part is string => part !== null);
  return kept.length > 0 ? kept.join("  ·  ") : null;
}
