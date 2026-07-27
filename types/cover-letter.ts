// ─── Cover Letter (Export) API Types ────────────────────────────────
//
// 정본은 「AI 자기소개서 Generator — 입력·출력 필드 명세」(BAC-62 의 원본 명세)다.
// 출력은 파이썬 `ApplicationResult` 를 `dataclasses.asdict()` 한 dict 가 그대로 온다.
//
// ⚠️ 백엔드(BAC-62)는 아직 없다 — arc-backend dev 트리에 `cover_letter` 매치 0건.
// 그래서 이 타입들은 **계약 선확정**이고, 노출은 플래그(lib/export/flags.ts)가 막는다.
// 명세가 "조건부"라 표시한 값(writing_guide·action_plan·company_research)은 기능이 꺼지면
// **빈 문자열**로 오고, meta 는 통째로 없을 수 있다 → 전부 optional 로 두고 화면에서 방어한다.

import type { AnalysisStatus } from "./analysis";

export type CoverLetterRegion = "KR" | "US";

// ─── 출력(Output) ───────────────────────────────────────────────────

/**
 * 근거 검증(환각 탐지) 결과. `verify_grounding()` 이 사실 원장에 없는 주장을 찾고,
 * 발견 시 `correct_draft()` 로 최대 N회 교정한 **최종 상태**다.
 *
 * `grounded=false` 는 "검증 실패"만이 아니라 **파싱 실패**일 때도 나온다(명세 명시).
 * 즉 false 인데 `unsupported_claims` 가 비어 있을 수 있으므로, 두 값을 각각 봐야 한다.
 */
export interface CoverLetterGrounding {
  grounded: boolean;
  /** 근거 없는(환각 의심) 문장 목록. 통과 시 빈 배열. 본문 부분 매칭용 원문 조각이다. */
  unsupported_claims: string[];
  /** 검증 총평 + "(교정 반복 N회)" 자동 부기. */
  notes: string;
}

export interface CoverLetterAnswer {
  /** 자소서 문항 원문(입력 순서 보존). 비워 입력하면 "(자유 형식)". */
  question: string;
  /** ★ 주 결과물 — 그대로 제출 가능한 완성형 본문. 문단은 개행(\n) 구분. */
  cover_letter: string;
  grounding: CoverLetterGrounding;
  /** 조건부 — include_writing_guide=false 면 빈 문자열. */
  writing_guide?: string;
  /**
   * 문항별 글자수 제한. 명세의 QUESTIONS 는 `{question, max_chars}` 를 허용하지만
   * 출력 AnswerResult 에는 이 값이 없다 — 생성 시 보낸 값을 화면이 기억할 수 없으므로
   * 서버가 실어 주면 쓰고, 아니면 카운터에서 상한 없이 글자수만 보여준다.
   */
  max_chars?: number;
}

/** 7필드 전부 `generate_application()` 종료 시 코드가 계산해 주입한다(LLM 미관여). */
export interface CoverLetterMeta {
  job_key?: string;
  /** 직무 한글 라벨 (예: "데이터 분석/사이언스"). */
  job_label?: string;
  region?: CoverLetterRegion;
  num_questions?: number;
  num_style_examples?: number;
  /** 회사 검색 리서치가 실제 수행·반영됐는지. 회사명 미입력·검색 실패 시 false. */
  company_research_used?: boolean;
  /** = all(a.grounding.grounded). "사실 확인 필요" 배너 판단에 쓴다. */
  all_grounded?: boolean;
}

export interface CoverLetterResult {
  answers: CoverLetterAnswer[];
  /** 조건부 — 회사명 미입력·검색 실패 시 빈 문자열 → 섹션 자체를 숨긴다. */
  company_research?: string;
  /** 조건부 — include_action_plan=false 면 빈 문자열. */
  action_plan?: string;
  meta?: CoverLetterMeta;
  /** 래퍼(`data.id`)에서 보존한 식별자. 본문에는 없을 수 있다. */
  version_id?: string;
  /** 래퍼에서 보존한 생성 시각 — draft 신선도 비교(isDraftNewer)에 쓴다. */
  created_at?: string;
}

export interface CoverLetterListItem {
  id: string;
  created_at: string;
  updated_at: string;
  title?: string;
  status?: AnalysisStatus;
}

// ─── 입력(Input) ────────────────────────────────────────────────────

/**
 * 생성 시 사용자가 입력하는 문항. 명세상 QUESTIONS 원소는 문자열 또는
 * `{question, max_chars}` 다 — 문자열이면 글자수 제한 기본 1000자.
 */
export interface CoverLetterQuestion {
  question: string;
  maxChars?: number;
}

/**
 * 생성 요청. **축적 이력(이름·학력·경력·프로젝트·스킬·자격·수상·활동·성과·강점) 10필드는
 * 백엔드가 인증 유저의 기록 DB에서 자동 로드**하므로 프런트가 보내지 않는다. 여기 있는 건
 * 명세 I-B(지원 컨텍스트)와 I-C(실행 파라미터)뿐이다.
 */
export interface CoverLetterCreateInput {
  /** 비우면 회사 리서치를 건너뛴다(명세 11번). */
  targetCompany?: string;
  targetJob?: string;
  motivation?: string;
  careerGoal?: string;
  extraNotes?: string;
  /** 비우면([]) 백엔드가 자유 형식 1건을 생성한다. */
  questions: CoverLetterQuestion[];
  region?: CoverLetterRegion;
  includeWritingGuide?: boolean;
  includeActionPlan?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * "모든 문항이 근거 검증을 통과했는가". `meta.all_grounded` 가 정본이지만 **없을 수 있어**
 * (구 백엔드·meta 누락) answers 에서 파생한다.
 *
 * ⚠️ 부재를 낙관적으로 true 로 두면 근거 없는 초안이 "확인 완료"로 보인다 — 이 기능이 막으려던
 * 바로 그 실패다. 그래서 파생도 통과 조건을 **명시적으로 만족할 때만** true 다.
 * answers 가 비면 판단할 근거 자체가 없으므로 false(=경고 쪽)로 둔다.
 */
export function isAllGrounded(result: CoverLetterResult): boolean {
  if (typeof result.meta?.all_grounded === "boolean") {
    return result.meta.all_grounded;
  }
  if (result.answers.length === 0) return false;
  return result.answers.every(
    (a) => a.grounding.grounded && a.grounding.unsupported_claims.length === 0,
  );
}

/** 문항 하나라도 근거 경고가 있는지 — 상단 요약 배너 노출 판정. */
export function hasUngroundedAnswer(result: CoverLetterResult): boolean {
  return result.answers.some(isAnswerUngrounded);
}

/**
 * 문항 단위 경고 판정. `grounded=false`(파싱 실패 포함)거나 근거 없는 주장이 하나라도 있으면 경고다.
 * 둘 중 하나만 봐서는 안 된다 — 명세상 파싱 실패 시 claims 가 빈 채로 false 가 온다.
 */
export function isAnswerUngrounded(answer: CoverLetterAnswer): boolean {
  return !answer.grounding.grounded || answer.grounding.unsupported_claims.length > 0;
}

/** 본문이 하나도 없는 결과 — 상세 화면의 빈 상태 판정(레쥬메 isEmptySection 대응). */
export function isEmptyCoverLetter(result: CoverLetterResult): boolean {
  return result.answers.every((a) => !a.cover_letter.trim());
}
