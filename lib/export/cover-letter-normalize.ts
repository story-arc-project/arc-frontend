import type {
  CoverLetterAnswer,
  CoverLetterGrounding,
  CoverLetterMeta,
  CoverLetterResult,
} from "@/types/cover-letter";

// 자소서 본문이 들어오는 **모든 경계**(서버 응답·localStorage draft)가 이 정규화를 통과한다.
// 한쪽만 통과시키면 draft 복원이 서버 경로의 방어를 우회해 화면이 크래시한다(resume-draft 교훈).
//
// 원칙: 서버 형태 변화에 throw 하지 않고 안전 분기한다(.claude/rules/api.md). 다만 **없는 것을
// 있는 척 지어내지도 않는다** — 특히 grounding 은 부재를 "통과"로 뭉개면 근거 없는 초안이
// "확인 완료"로 보이므로, 읽을 수 없으면 경고 쪽(grounded=false)으로 떨어뜨린다.

function asRecord(value: unknown): Record<string, unknown> | null {
  // 배열은 레코드가 아니다 — 스프레드하면 {} 로 뭉개져 "본문 있음"으로 오인된다(FRT-134).
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/**
 * grounding 정규화. **부재·형태 이상은 경고로 떨어진다**(grounded=false).
 * 명세도 "파싱 실패 시에도 false" 라고 못박고 있어 이 방향이 계약과 같다.
 */
function normalizeGrounding(raw: unknown): CoverLetterGrounding {
  const r = asRecord(raw);
  if (!r) {
    return {
      grounded: false,
      unsupported_claims: [],
      notes: "",
    };
  }
  return {
    // boolean 이 아니면(부재·문자열 등) 통과로 보지 않는다.
    grounded: r.grounded === true,
    unsupported_claims: asStringArray(r.unsupported_claims),
    notes: asString(r.notes),
  };
}

function normalizeAnswer(raw: unknown): CoverLetterAnswer | null {
  const r = asRecord(raw);
  if (!r) return null;

  const cover_letter = asString(r.cover_letter);
  const question = asString(r.question);
  // 본문도 문항도 없는 원소는 화면에 낼 것이 없다 — 빈 카드를 만들지 말고 버린다.
  if (!cover_letter.trim() && !question.trim()) return null;

  const maxChars = r.max_chars;

  return {
    // 명세: 비워 입력하면 "(자유 형식)" 으로 대체된다. 서버가 안 채웠으면 여기서 채운다 —
    // 빈 제목 카드는 "문항이 사라진 것"처럼 보인다.
    question: question.trim() ? question : "(자유 형식)",
    cover_letter,
    grounding: normalizeGrounding(r.grounding),
    // 조건부 필드는 빈 문자열로 오므로 빈 값은 아예 키를 비워 화면이 `?` 하나로 숨길 수 있게 한다.
    ...(asString(r.writing_guide).trim() ? { writing_guide: asString(r.writing_guide) } : {}),
    ...(typeof maxChars === "number" && Number.isFinite(maxChars) && maxChars > 0
      ? { max_chars: maxChars }
      : {}),
  };
}

function normalizeMeta(raw: unknown): CoverLetterMeta | undefined {
  const r = asRecord(raw);
  if (!r) return undefined;

  const region = r.region === "US" || r.region === "KR" ? r.region : undefined;
  const meta: CoverLetterMeta = {
    ...(asString(r.job_key) ? { job_key: asString(r.job_key) } : {}),
    ...(asString(r.job_label) ? { job_label: asString(r.job_label) } : {}),
    ...(region ? { region } : {}),
    ...(typeof r.num_questions === "number" ? { num_questions: r.num_questions } : {}),
    ...(typeof r.num_style_examples === "number"
      ? { num_style_examples: r.num_style_examples }
      : {}),
    ...(typeof r.company_research_used === "boolean"
      ? { company_research_used: r.company_research_used }
      : {}),
    // ⚠️ boolean 일 때만 싣는다. 부재를 false 로 채우면 "전부 검증 실패"로 보이고,
    // true 로 채우면 검증 안 된 초안이 "확인 완료"가 된다. 둘 다 거짓말이므로 **비운다** —
    // isAllGrounded 가 answers 에서 파생하게 넘긴다.
    ...(typeof r.all_grounded === "boolean" ? { all_grounded: r.all_grounded } : {}),
  };

  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * 서버 응답 본문(ApplicationResult) → 화면이 믿고 쓰는 CoverLetterResult.
 * answers 가 배열이 아니면 빈 배열로 떨어뜨린다 — 호출부(상세 페이지)가 빈 상태를 보여준다.
 */
export function normalizeCoverLetter(raw: unknown): CoverLetterResult {
  const r = asRecord(raw) ?? {};

  const answers = Array.isArray(r.answers)
    ? r.answers
        .map(normalizeAnswer)
        .filter((a): a is CoverLetterAnswer => a !== null)
    : [];

  const companyResearch = asString(r.company_research);
  const actionPlan = asString(r.action_plan);
  const versionId = asString(r.version_id) || asString(r.id);
  const createdAt = asString(r.created_at);

  return {
    answers,
    ...(companyResearch.trim() ? { company_research: companyResearch } : {}),
    ...(actionPlan.trim() ? { action_plan: actionPlan } : {}),
    ...(normalizeMeta(r.meta) ? { meta: normalizeMeta(r.meta) } : {}),
    ...(versionId ? { version_id: versionId } : {}),
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}
