import type { ResumeLanguage } from "@/types/resume";

/**
 * FRT-147 — 레쥬메 섹션 제목의 단일 출처.
 *
 * 제목은 지금 세 곳(프리뷰 `Preview*`, 문서 IR `resume-document`, 편집기 `ResumeEditorPanel`)에
 * 각자 하드코딩돼 있다. 영문 레쥬메를 살리면서 세 곳에 영문 문자열을 또 흩뿌리면 규칙이 세 벌로
 * 갈라지므로(`resume-document.ts` 상단 주석이 경고하는 그 위험) 여기 한 곳에 둔다.
 *
 * 국문 값은 **현행 화면 문자열 그대로**다 — 라벨 도입이 국문 출력을 바꾸면 안 된다.
 */
export interface ResumeSectionLabels {
  personalInfo: string;
  summary: string;
  education: string;
  career: string;
  project: string;
  activity: string;
  club: string;
  award: string;
  certification: string;
  language: string;
  skills: string;
  additionalInfo: string;
  publication: string;
}

const KO: ResumeSectionLabels = {
  personalInfo: "인적사항",
  summary: "자기소개",
  education: "학력",
  career: "경력",
  project: "프로젝트",
  activity: "대외활동",
  club: "동아리 · 학회",
  award: "수상",
  certification: "자격증",
  language: "어학",
  skills: "기술 및 역량",
  additionalInfo: "기타정보",
  publication: "논문",
};

/**
 * 서구권 CV 관례를 따른다. `club` 은 rev.5 명세상 영문에서 `activities` 로 흡수되므로
 * 영문 레쥬메에서는 실제로 렌더되지 않지만, 타입을 반쪽으로 두지 않도록 값은 채워 둔다.
 */
const EN: ResumeSectionLabels = {
  personalInfo: "Contact",
  summary: "Summary",
  education: "Education",
  career: "Work Experience",
  project: "Projects",
  activity: "Activities",
  club: "Activities",
  award: "Awards",
  certification: "Certifications",
  language: "Languages",
  skills: "Skills",
  additionalInfo: "Additional Information",
  publication: "Publications",
};

/**
 * 언어를 모르거나(구 응답에 meta 가 없을 수 있다) 알 수 없는 값이면 국문으로 폴백한다 —
 * 서비스 기본이 국문이고, 폴백이 영문이면 국문 사용자가 영문 제목을 보게 된다.
 */
export function resumeSectionLabels(
  language: ResumeLanguage | null | undefined,
): ResumeSectionLabels {
  return language === "en" ? EN : KO;
}
