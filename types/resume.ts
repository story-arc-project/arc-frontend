// ─── Resume (Export) API Types ──────────────────────────────────────
// Korean property names are kept as-is from the backend schema.

import type { AnalysisStatus } from "./analysis";

export type ResumeLanguage = "ko" | "en";
export type ResumeFormat = "json" | string;

// ─── 선택지 enum ────────────────────────────────────────────────────
//
// 정본은 백엔드 생성 프롬프트(arc-backend `ai_analyst/src/ai/resume.py` 의 _SYS_KO 스키마)다.
// FRT-109 에서 실값과 대조해 네 개가 어긋나 있던 것을 맞췄다 — 어긋나면 AI 가 실제로 낸 값
// (예: 자격구분 "국가자격")이 편집기 드롭다운에 없어, 미리보기엔 보이는 값을 편집기에서는
// 고를 수 없었다. 자격구분·단체구분은 기존 선택지와 교집합이 사실상 없어 통째로 교체했다.
//
// 선택지 배열이 정본이고 타입은 거기서 파생된다. 이전엔 union 타입과 편집기의 `…Options`
// 배열이 같은 값을 각각 하드코딩해 **두 출처가 조용히 갈라진 것**이 이 결함의 뿌리였다.
// 백엔드가 내지 않지만 사용자가 고를 수 있어야 하는 값(휴학·전문학사)은 남겨 표현력을 지킨다.

export const 전공구분_OPTIONS = ["주전공", "복수전공", "부전공", "연계전공"] as const;
export const 학위_OPTIONS = ["학사", "석사", "박사", "수료", "전문학사"] as const;
export const 졸업구분_OPTIONS = ["졸업", "재학중", "졸업예정", "수료", "중퇴", "휴학"] as const;
export const 고용형태_OPTIONS = ["정규직", "계약직", "인턴", "파트타임", "프리랜서"] as const;
export const 자격구분_OPTIONS = ["국가자격", "민간자격", "어학", "기타"] as const;
export const 단체구분_OPTIONS = [
  "교내동아리",
  "교내학회",
  "연합동아리",
  "외부학회",
  "기타",
] as const;

/**
 * FRT-147 — 영문 레쥬메는 같은 자리에 영문 원문(`Bachelor`·`Full-time`·`Graduated`)이 온다.
 * 국문 enum 으로 번역해 넣으면 **영문 CV 에 "학사"가 찍히므로** 원문을 그대로 통과시킨다.
 * `string & Record<never, never>` 는 리터럴 자동완성을 유지하면서 임의 문자열을 허용하는
 * 관용구다 — 편집기 드롭다운의 정본은 그대로 `…_OPTIONS` 배열이다.
 */
type OrRawString<T extends string> = T | (string & Record<never, never>);

export type 전공구분 = (typeof 전공구분_OPTIONS)[number];
export type 학위 = (typeof 학위_OPTIONS)[number];
export type 졸업구분 = (typeof 졸업구분_OPTIONS)[number];
export type 고용형태 = (typeof 고용형태_OPTIONS)[number];
export type 자격구분 = (typeof 자격구분_OPTIONS)[number];
export type 단체구분 = (typeof 단체구분_OPTIONS)[number];

export interface ResumeMeta {
  language: ResumeLanguage;
  format: ResumeFormat;
  generated_at: string;
  source_chars: number;
  // ─── rev.5 (FRT-207) ───────────────────────────────────────────────
  // 생성기가 실행 파라미터·계산 결과를 되돌려주는 값들. 백엔드가 rev.5 를 구현하기
  // 전까지는 전부 부재하므로 옵셔널이다 — 부재를 "0" 으로 읽으면 안 된다(아래 주석 참고).
  target_role?: string | null;
  template?: string | null;
  selected_experiences?: string[] | null;
  max_pages?: number;
  auto_fill?: boolean;
  page_line_budget?: number;
  표시된_경험수?: number;
  /**
   * 1쪽 예산을 넘겨 `표시=false` 로 보류된 경험 수. **부재(undefined)와 0 은 다르다** —
   * 부재는 "백엔드가 아직 판정하지 않음", 0 은 "판정했고 보류된 게 없음"이다.
   * 부재를 0 으로 뭉개면 안내를 못 띄우는 데서 그치지만, 0 을 부재로 뭉개면
   * "0개 경험이 더 있어요" 가 뜬다.
   */
  보류된_경험수?: number;
}

/**
 * 경험형 섹션(경력·프로젝트·대외활동·동아리_학회)에 생성기가 얹는 표시 제어 필드.
 *
 * rev.5 `_apply_page_budget()` 이 1쪽 예산 안에서 계산해 부여한다. 백엔드가 아직 안 보내므로
 * 옵셔널이고, **아무 항목에도 없으면 필터가 통째로 비활성**된다(`visibleExperiences`).
 */
export interface DisplayControl {
  표시?: boolean;
  표시순위?: number | null;
}

export interface PersonalInfoLink {
  label: string | null;
  url: string;
}

export interface PersonalInfo {
  이름: string | null;
  영문명: string | null;
  생년월일: string | null;
  이메일: string | null;
  전화번호: string | null;
  주소: string | null;
  링크: PersonalInfoLink[];
}

export interface Education {
  id: number;
  학교명: string | null;
  학과: string | null;
  전공구분: 전공구분 | null;
  학위: OrRawString<학위> | null;
  입학년월: string | null;
  졸업년월: string | null;
  졸업구분: OrRawString<졸업구분> | null;
  학점: number | null;
  만점: number | null;
  비고: string | null;
}

export interface Career extends DisplayControl {
  id: number;
  회사명: string | null;
  부서: string | null;
  직위: string | null;
  고용형태: OrRawString<고용형태> | null;
  입사년월: string | null;
  퇴사년월: string | null;
  재직중: boolean;
  담당업무: string[];
  성과: string[];
}

export interface Certification {
  id: number;
  자격증명: string | null;
  발급기관: string | null;
  취득년월: string | null;
  자격구분: OrRawString<자격구분> | null;
}

export interface LanguageItem {
  id: number;
  언어: string | null;
  /** rev.5 — 시험 점수와 별개인 자기평가(원어민·능통·중급). 없으면 현행 표기 그대로. */
  능통도?: string | null;
  시험명: string | null;
  점수등급: string | null;
  취득년월: string | null;
}

export interface Activity extends DisplayControl {
  id: number;
  활동명: string | null;
  기관: string | null;
  기간_시작: string | null;
  기간_종료: string | null;
  기간_원문: string | null;
  진행중: boolean;
  역할: string | null;
  활동내용: string[];
  성과: string[];
}

export interface Project extends DisplayControl {
  id: number;
  프로젝트명: string | null;
  소속기관: string | null;
  기간_시작: string | null;
  기간_종료: string | null;
  기간_원문: string | null;
  역할: string | null;
  사용기술: string[];
  내용: string[];
  성과: string[];
}

export interface Award {
  id: number;
  수상명: string | null;
  수여기관: string | null;
  수상년월: string | null;
  내용: string | null;
}

export interface Skills {
  기술스택: string[];
  툴: string[];
  소프트스킬: string[];
}

export interface Club extends DisplayControl {
  id: number;
  단체명: string | null;
  구분: 단체구분 | null;
  기간_원문: string | null;
  역할: string | null;
  활동내용: string[];
}

/**
 * rev.5 신규 섹션 — 어학을 뺀 나머지 기타 정보. 어학은 최상위 `어학[]` 이 정본이다.
 * 백엔드가 아직 내지 않으므로 `ResumeVersion` 에서 옵셔널이다.
 */
export interface AdditionalInfo {
  병역: string | null;
  관심사: string[];
}

/**
 * 영문 전용 섹션(`publications`). 국문 스키마에 대응 키가 없어 별도로 둔다 —
 * `동아리_학회` 자리를 재사용하면 `구분` enum 이 맞지 않고 국문 화면으로 샌다.
 */
export interface Publication {
  id: number;
  제목: string | null;
  게재처: string | null;
  발표년월: string | null;
  내용: string | null;
}

// TODO(backend): namespace for 연계성 is pending clarification. Keep type
// but do not render its editor or preview until resolved.
export interface Linkage {
  항목ids: number[];
  연결점: string | null;
}

export interface ResumeVersion {
  version_id?: string;
  meta: ResumeMeta;
  인적사항: PersonalInfo;
  학력: Education[];
  경력: Career[];
  자격증: Certification[];
  어학: LanguageItem[];
  대외활동: Activity[];
  프로젝트: Project[];
  수상: Award[];
  기술및역량: Skills;
  동아리_학회: Club[];
  연계성: Linkage[];
  자기소개_요약: string | null;
  파싱경고: string[];
  /** rev.5 신규 섹션 — 백엔드 미구현이라 옵셔널. 어학 → 기술및역량 다음 최하단에 온다. */
  기타정보?: AdditionalInfo;
  /** 영문 전용 — EN 응답의 `publications`. 국문 레쥬메에는 없다. */
  논문?: Publication[];
}

// 백엔드 GET /export/resume 의 contents 항목.
// 계약(§2.4)상 서버가 목록에 title·language·status 를 실어야 한다. 아직 계약을 이행하지
// 않은 백엔드에서는 이 셋이 없으므로 옵셔널로 두고, 부재 시 생성 시각 라벨로 폴백한다(dual-compat).
export interface ResumeListItem {
  version_id: string;
  created_at: string;
  updated_at: string;
  title?: string;
  language?: ResumeLanguage;
  status?: AnalysisStatus;
}

// ─── Section emptiness helper ──────────────────────────────────────
// Used by preview to hide empty sections.

export function isEmptySection(section: unknown): boolean {
  if (section === null || section === undefined) return true;
  if (typeof section === "string") return section.trim() === "";
  if (Array.isArray(section)) return section.length === 0 || section.every((item) => isEmptySection(item));
  if (typeof section === "object" && section !== null) {
    const entries = Object.entries(section as Record<string, unknown>);
    if (entries.length === 0) return true;
    return entries.every(([key, v]) => {
      // id 와 표시 제어 필드는 **내용이 아니다**. 이걸 값으로 세면 내용이 하나도 없는데
      // `표시: true` 만 달린 항목이 "비어 있지 않다"가 되어 유령 행으로 렌더된다
      // (FRT-122 의 유령 빈 행과 같은 계열). rev.5 가 표시/표시순위를 얹기 시작하면
      // 곧바로 재현되므로 제어 키를 여기서 함께 제외한다.
      if (key === "id" || key === "표시" || key === "표시순위") return true;
      if (v === null || v === undefined) return true;
      if (Array.isArray(v)) return v.length === 0 || v.every((item) => isEmptySection(item));
      if (typeof v === "string") return v.trim() === "";
      if (typeof v === "boolean") return !v;
      if (typeof v === "object") return isEmptySection(v);
      return false;
    });
  }
  return false;
}
