// ─── Resume (Export) API Types ──────────────────────────────────────
// Korean property names are kept as-is from the backend schema.

export type ResumeLanguage = "ko" | "en";
export type ResumeFormat = "json" | string;

export type 전공구분 = "주전공" | "복수전공" | "부전공" | "연계전공";
export type 학위 = "학사" | "석사" | "박사" | "전문학사";
export type 졸업구분 = "졸업" | "재학" | "휴학" | "수료" | "중퇴" | "졸업예정";
export type 고용형태 = "정규직" | "계약직" | "인턴" | "파트타임" | "프리랜서";
export type 자격구분 = "자격증" | "면허" | "수료증";
export type 단체구분 = "동아리" | "학회" | "학생회" | "기타";

export interface ResumeMeta {
  language: ResumeLanguage;
  format: ResumeFormat;
  generated_at: string;
  source_chars: number;
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
  학위: 학위 | null;
  입학년월: string | null;
  졸업년월: string | null;
  졸업구분: 졸업구분 | null;
  학점: number | null;
  만점: number | null;
  비고: string | null;
}

export interface Career {
  id: number;
  회사명: string | null;
  부서: string | null;
  직위: string | null;
  고용형태: 고용형태 | null;
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
  자격구분: 자격구분 | null;
}

export interface LanguageItem {
  id: number;
  언어: string | null;
  시험명: string | null;
  점수등급: string | null;
  취득년월: string | null;
}

export interface Activity {
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

export interface Project {
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

export interface Club {
  id: number;
  단체명: string | null;
  구분: 단체구분 | null;
  기간_원문: string | null;
  역할: string | null;
  활동내용: string[];
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
}

export interface ResumeListItem {
  version_id: string;
  language: ResumeLanguage;
  generated_at: string;
  summary_preview: string | null;
}

// ─── Section emptiness helper ──────────────────────────────────────
// Used by preview to hide empty sections.

export function isEmptySection(section: unknown): boolean {
  if (section === null || section === undefined) return true;
  if (Array.isArray(section)) return section.length === 0 || section.every((item) => isEmptySection(item));
  if (typeof section === "object" && section !== null) {
    const values = Object.values(section as Record<string, unknown>);
    if (values.length === 0) return true;
    return values.every((v) => {
      if (v === null || v === undefined) return true;
      if (Array.isArray(v)) return v.length === 0 || v.every((item) => isEmptySection(item));
      if (typeof v === "string") return v.trim() === "";
      if (typeof v === "number") return true;
      if (typeof v === "boolean") return !v;
      if (typeof v === "object") return isEmptySection(v);
      return false;
    });
  }
  return false;
}
