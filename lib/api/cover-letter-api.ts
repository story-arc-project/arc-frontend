import { api, ApiError } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { AnalysisStatus } from "@/types/analysis";
import type {
  CoverLetterCreateInput,
  CoverLetterListItem,
  CoverLetterResult,
} from "@/types/cover-letter";
import { normalizeCoverLetter } from "@/lib/export/cover-letter-normalize";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

// ─── 계약 ───────────────────────────────────────────────────────────
//
// 정본은 「AI 자기소개서 Generator — 입력·출력 필드 명세」(BAC-62 의 원본).
//
// ⚠️ **백엔드가 아직 없다** — arc-backend dev 트리에 `cover_letter` 매치 0건(BAC-62 Todo).
// 게다가 명세는 파이썬 `main()/generate_application()` 시그니처 기준이라 **HTTP 경로도 요청
// body 필드명도 규정하지 않는다.** 그래서 경로는 레쥬메(`/export/resume`) 대칭으로 잡고,
// body 는 명세의 필드명을 그대로 snake_case 로 보낸다. 착수 시 AI팀과 재확인이 필요하다.
//
// 오추정이 사용자에게 새지 않도록 **노출은 플래그(lib/export/flags.ts)가 막는다.** 이 모듈은
// flag-agnostic 이다 — 게이팅은 호출부(익스포트 페이지)가 한다(FRT-108 교훈: 컴포넌트/클라이언트
// 안에서 NEXT_PUBLIC_* 를 읽으면 빌드타임 인라인 탓에 Storybook 에서 영영 false 다).
const BASE_PATH = "/export/cover-letter";

// ─── Defensive parsing helpers ─────────────────────────────────────
// export-api.ts 와 같은 태도의 로컬 헬퍼다(파일별 방어 헬퍼 반복이 이 코드베이스의 관례).

/**
 * 백엔드 status("pending"|"queued"|"success"|"failed") → 프런트 enum.
 * 목록 배지는 "미표시"가 유효 상태이므로 알 수 없는/부재 값은 "pending" 으로 뭉개지 않고
 * undefined 로 둔다(export-api 의 mapResumeStatus 와 동일 태도).
 */
function mapCoverLetterStatus(value: unknown): AnalysisStatus | undefined {
  switch (value) {
    case "queued":
      return "processing";
    case "success":
      return "completed";
    case "failed":
      return "failed";
    case "processing":
      return "processing";
    case "pending":
      return "pending";
    default:
      return undefined;
  }
}

/**
 * 생성 응답에서 id 를 추출한다(레쥬메 계약 §2.4 대칭: POST → { id, title }).
 * 계약 미이행 백엔드는 id 를 주지 않으므로 부재 시 null → 호출부는 목록 새로고침으로 폴백한다.
 */
function extractCoverLetterId(res: unknown): { id: string | null; title?: string } {
  if (res === null || typeof res !== "object") return { id: null };
  const root = res as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const id =
    (typeof data.id === "string" && data.id) ||
    (typeof data.cover_letter_id === "string" && data.cover_letter_id) ||
    "";
  const title = typeof data.title === "string" ? data.title : undefined;
  return { id: id || null, title };
}

/**
 * 응답은 왔지만 **본문이 아직 없다**(생성 중이거나 실패). "못 불러왔다"와 구별해야 하는
 * 상태다 — 사용자에게 할 말이 다르기 때문이다("아직 만들고 있어요" vs "불러오지 못했어요").
 *
 * 전용 타입으로 두는 이유: 호출부가 `!(err instanceof ApiError)` 같은 소거법으로 판정하면
 * **네트워크 장애까지 "생성 중"으로 뭉개진다.** 통신이 끊긴 사용자에게 "곧 완료돼요"라고
 * 말하면 기다리기만 하다 아무 일도 일어나지 않는다.
 */
export class CoverLetterNotReadyError extends Error {
  constructor() {
    super("cover letter result not ready");
    this.name = "CoverLetterNotReadyError";
  }
}

/**
 * GET 응답에서 자소서 본문(ApplicationResult)을 꺼낸다.
 *
 * 래퍼는 레쥬메와 같은 모양을 가정한다: `data = { id, title, status, created_at, updated_at, result }`.
 * 백엔드가 §3 result 규약 통일로 data 자체를 평탄화해도 안 깨지도록 result 부재 시 data 로 폴백한다.
 *
 * ⚠️ **아직 생성 중/실패한 자소서**는 `result: null` 로 온다. 그 껍데기를 본문이라고 반환하면
 * 상세 화면이 "문항 0개인 빈 자소서"를 성공처럼 보여준다 — 생성은 진행 중인데 화면만 실패로
 * 보이는(또는 그 반대) 오진을 낳는다(FRT-134·레쥬메 unwrapResumeVersion 과 같은 실패 모드).
 * 그래서 본문 마커(`answers`)가 없으면 throw 해 호출부가 제어된 로딩/에러 상태를 내게 한다.
 */
function unwrapCoverLetter(data: unknown): unknown {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const root = data as Record<string, unknown>;

    // 배열은 본문 레코드가 아니다. result:[] 를 큐잉 센티넬로 쓰는 백엔드가 있으면
    // 빈 껍데기를 본문으로 오인한다.
    if (
      root.result !== null &&
      typeof root.result === "object" &&
      !Array.isArray(root.result)
    ) {
      const content = root.result as Record<string, unknown>;
      if (!Array.isArray(content.answers)) {
        throw new CoverLetterNotReadyError();
      }
      // 래퍼의 메타(id·created_at)를 본문에 보존한다 — 본문에는 없을 수 있고,
      // draft 신선도 비교(isDraftNewer)가 created_at 을 쓴다.
      return {
        ...content,
        ...(content.version_id === undefined && typeof root.id === "string"
          ? { version_id: root.id }
          : {}),
        ...(content.created_at === undefined && typeof root.created_at === "string"
          ? { created_at: root.created_at }
          : {}),
      };
    }

    // result 부재 = ① 평탄화된 본문(dual-compat) 또는 ② 미완/실패 래퍼(result:null).
    // 전자만 본문 마커(answers)를 갖는다.
    if (Array.isArray(root.answers)) return root;
  }
  throw new CoverLetterNotReadyError();
}

// ─── Endpoints ─────────────────────────────────────────────────────

/**
 * 자소서 생성. **비동기다** — 서버가 id 를 즉시 주더라도 본문(result)은 나중에 채워진다
 * (레쥬메와 같음). 생성 직후 상세로 이동하면 아직 준비 안 된 자소서를 로드해 실패 화면이 뜬다.
 *
 * 축적 이력(이름·학력·경력·프로젝트·스킬·자격·수상·활동·성과·강점)은 **백엔드가 인증 유저의
 * 기록 DB에서 자동 로드**하므로 여기서 보내지 않는다(명세 I-A).
 */
export async function createCoverLetter(
  input: CoverLetterCreateInput,
  options?: { signal?: AbortSignal },
): Promise<{ id: string | null; title?: string }> {
  if (isDemoMode()) return demo.createCoverLetter(input);

  const body: Record<string, unknown> = {
    // 명세 16번: 문자열 또는 {question, max_chars}. 제한이 없으면 문자열로 보내 백엔드 기본값
    // (1000자)을 살린다 — max_chars: null 을 실어 보내면 기본값을 덮어쓸 위험이 있다.
    questions: input.questions.map((q) =>
      typeof q.maxChars === "number" && q.maxChars > 0
        ? { question: q.question, max_chars: q.maxChars }
        : q.question,
    ),
  };

  // 빈 값은 **키 자체를 뺀다** — 백엔드 기본값이 살아 있어야 하고, 특히 target_company 는
  // "빈 문자열"과 "미입력"이 같은 뜻(리서치 생략)이라 굳이 실어 보낼 이유가 없다.
  // (레쥬메 experience_ids 교훈: 미지정을 빈 값으로 뭉개면 계약이 달라진다.)
  if (input.targetCompany?.trim()) body.target_company = input.targetCompany.trim();
  if (input.targetJob?.trim()) body.target_job = input.targetJob.trim();
  if (input.motivation?.trim()) body.motivation = input.motivation.trim();
  if (input.careerGoal?.trim()) body.career_goal = input.careerGoal.trim();
  if (input.extraNotes?.trim()) body.extra_notes = input.extraNotes.trim();
  if (input.region) body.region = input.region;
  if (input.includeWritingGuide !== undefined) {
    body.include_writing_guide = input.includeWritingGuide;
  }
  if (input.includeActionPlan !== undefined) {
    body.include_action_plan = input.includeActionPlan;
  }

  const res = await api.post<ApiSuccessResponse<unknown>>(BASE_PATH, body, options);
  return extractCoverLetterId(res);
}

export async function getCoverLetter(id: string): Promise<CoverLetterResult> {
  if (isDemoMode()) return demo.getCoverLetter(id);
  const res = await api.get<ApiSuccessResponse<unknown>>(`${BASE_PATH}/${id}`);
  return normalizeCoverLetter(unwrapCoverLetter(res.data));
}

/** 서버 응답: data = { count, contents: [{ id, created_at, updated_at, status, title }] } */
export async function getCoverLetterList(): Promise<CoverLetterListItem[]> {
  if (isDemoMode()) return demo.getCoverLetterList();
  const res = await api.get<ApiSuccessResponse<unknown>>(BASE_PATH);
  return readContents(res.data)
    .map(toListItem)
    .filter((item): item is CoverLetterListItem => item !== null);
}

// 래퍼가 벗겨진 배열로 오는 경우까지 받아둔다.
function readContents(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data === null || typeof data !== "object") return [];
  const contents = (data as Record<string, unknown>).contents;
  return Array.isArray(contents) ? contents : [];
}

function toListItem(raw: unknown): CoverLetterListItem | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" ? r.id : "";
  if (id === "") return null;

  const createdAt = typeof r.created_at === "string" ? r.created_at : "";

  return {
    id,
    created_at: createdAt,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : createdAt,
    ...(typeof r.title === "string" && r.title ? { title: r.title } : {}),
    status: mapCoverLetterStatus(r.status),
  };
}

/**
 * 서버 저장(PATCH)이 아직 없다. 호출부는 이 에러를 잡아 **로컬 draft** 로 폴백한다.
 * 레쥬메의 ResumeMutationUnsupportedError 와 같은 역할이되, 판정을 공유하지 않는다 —
 * 폴백 판정을 공유하면 한쪽 기능의 실패가 멀쩡한 다른 버튼까지 숨긴다(FRT-111 교훈).
 */
export class CoverLetterMutationUnsupportedError extends Error {
  constructor(readonly status: number) {
    super("cover letter mutation not supported yet");
    this.name = "CoverLetterMutationUnsupportedError";
  }
}

/**
 * 저장 폴백 판정 — 405/501 에 **422** 를 더한다.
 *
 * 백엔드가 없으니 라우트 부재(405/501)가 기본이지만, 레쥬메가 그랬듯 `title` 만 받는 좁은
 * PATCH 가 먼저 생기면 본문을 보낼 때 422 가 난다. 원인은 같은데 코드만 다른 셈이라 폴백에서
 * 빠지면 고친 내용이 로컬에도 남지 못하고 사라진다(FRT-148).
 *
 * ⚠️ 임시 조치다. BAC-62 의 저장 계약이 생기면 **422 를 여기서 빼야** 한다 — 그때는 422 가
 * 진짜 검증 실패를 뜻하는데 "곧 제공될 예정" 안내로 삼키면 사용자는 원인을 영영 모른다.
 */
function isUnsupportedSaveStatus(err: unknown): err is ApiError {
  return err instanceof ApiError && [501, 405, 422].includes(err.status);
}

export async function updateCoverLetter(
  id: string,
  data: CoverLetterResult,
): Promise<CoverLetterResult> {
  if (isDemoMode()) return demo.updateCoverLetter(id, data);
  let res: ApiSuccessResponse<unknown>;
  try {
    res = await api.patch<ApiSuccessResponse<unknown>>(`${BASE_PATH}/${id}`, data);
  } catch (err) {
    if (isUnsupportedSaveStatus(err)) {
      throw new CoverLetterMutationUnsupportedError(err.status);
    }
    throw err;
  }

  try {
    return normalizeCoverLetter(unwrapCoverLetter(res.data));
  } catch {
    // 2xx 인데 본문(answers)이 없다 = 요청은 받아줬지만 **자소서 본문은 저장되지 않았다**.
    // 422 와 결과가 같으므로 판정도 같아야 한다 — 일반 에러로 흘리면 폴백을 못 타서 임시 저장이
    // 남지 않고, 이 코드가 막으려던 손실이 상태코드만 바꿔 재현된다(FRT-148).
    throw new CoverLetterMutationUnsupportedError(200);
  }
}

export async function deleteCoverLetter(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteCoverLetter(id);
  try {
    await api.delete<void>(`${BASE_PATH}/${id}`);
  } catch (err) {
    // 삭제에는 422 를 묶지 않는다 — body 가 없어 422 가 날 이유가 없고, 묶으면 멀쩡한 삭제
    // 버튼이 "곧 제공될 예정" 안내와 함께 숨는다(FRT-111 교훈).
    if (err instanceof ApiError && [501, 405].includes(err.status)) {
      throw new CoverLetterMutationUnsupportedError(err.status);
    }
    throw err;
  }
}
