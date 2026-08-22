import { api } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { AnalysisStatus } from "@/types/analysis";
import type {
  ResumeLanguage,
  ResumeListItem,
  ResumeVersion,
} from "@/types/resume";
import { normalizeResumeVersion } from "@/lib/export/resume-normalize";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

// ─── Defensive parsing helpers ─────────────────────────────────────

/**
 * 백엔드 status("pending"|"queued"|"success"|"failed") → 프런트 enum.
 * analysis-api 의 mapStatus 와 값 매핑은 동일하다(queued→processing, success→completed,
 * 이미 프런트형인 processing 은 그대로 통과). 단 목록 배지는 "미표시"가 유효 상태이므로
 * 알 수 없는/부재 값은 mapStatus 처럼 "pending" 으로 뭉개지 않고 undefined 로 둔다.
 */
function mapResumeStatus(value: unknown): AnalysisStatus | undefined {
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
      return undefined; // 필드 부재(구 백엔드)·미지 값 → 상태 미표시
  }
}

/**
 * 생성 응답에서 id 를 추출한다(계약 §2.4: POST → { id, title }).
 * 아직 계약 미이행 백엔드는 id 를 주지 않으므로 부재 시 null → 목록 새로고침으로 폴백.
 */
function extractResumeId(res: unknown): { id: string | null; title?: string } {
  if (res === null || typeof res !== "object") return { id: null };
  const root = res as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const id =
    (typeof data.id === "string" && data.id) ||
    (typeof data.resume_id === "string" && data.resume_id) ||
    "";
  const title = typeof data.title === "string" ? data.title : undefined;
  return { id: id || null, title };
}

// ─── Resume endpoints ──────────────────────────────────────────────

// 계약(§2.4)상 POST 는 { id, title } 을 돌려준다. id 가 오면 생성 직후 상세로 이동할 수
// 있고(호출부 판단), 아직 계약 미이행 백엔드처럼 id 가 없으면 null → 목록 새로고침으로 폴백한다.
export async function createResume(
  params: {
    language: ResumeLanguage;
    title?: string;
    /**
     * 레쥬메에 넣을 경험 id (FRT-109). 계약(BAC-45)상 `experience_ids` 는 Optional 이고
     * **부재 = 사용자의 전체 경험**(현행 동작), 빈 배열은 거절(422)이다. 그래서 미지정을 []
     * 로 뭉개면 안 되고 키 자체를 빼야 한다 — 0개 선택 차단은 호출부(모달)의 책임이다.
     *
     * 백엔드는 이 필드를 실제로 받는다(`ResumePostRequest.experience_ids`, 소유권 검증 +
     * 미존재 id 는 404). "보내도 조용히 무시된다"던 위험은 해소됐다. 노출 게이팅은 여전히
     * 플래그(lib/export/flags.ts)가 호출부에서 하고, 이 함수는 flag-agnostic 이다.
     */
    experienceIds?: string[];
  },
  options?: { signal?: AbortSignal },
): Promise<{ id: string | null; title?: string }> {
  if (isDemoMode()) {
    await demo.createResume(params);
    return { id: null };
  }
  const body: Record<string, unknown> = { language: params.language };
  if (params.title !== undefined) body.title = params.title;
  if (params.experienceIds !== undefined) body.experience_ids = params.experienceIds;
  // FRT-207 — 기본 생성은 1쪽 제한(7/25 확정). "사용자가 직접 수정할 때는 1쪽 제안을 두지
  // 않는다"가 같은 결정의 나머지 절반이라, 이건 **생성 시점에만** 걸리는 값이고 편집 저장
  // (PATCH)에는 붙지 않는다. 사용자가 고를 일이 없으니 UI 없이 상수로 보낸다(입력 허들 최소화).
  // experience_ids 와 마찬가지로 백엔드가 아직 안 받지만 extra="ignore" 라 조용히 무시된다.
  body.max_pages = 1;
  // auto_fill 은 명세상 `true = 선택 경험 외 남는 공간을 관련도순 경험으로 자동 채움`,
  // `false = 선택 경험만 표시` 다. 그래서 사용자가 경험을 **직접 골랐다면 false** 여야 한다 —
  // true 로 보내면 사용자가 일부러 뺀 경험이 1쪽 여백을 메우려고 되돌아온다. 선택이 없을
  // 때(=전체 경험)만 자동 채움이 사용자 의도와 어긋나지 않는다.
  body.auto_fill = params.experienceIds === undefined;
  const res = await api.post<ApiSuccessResponse<unknown>>(
    "/export/resume",
    body,
    options,
  );
  return extractResumeId(res);
}

export async function getResume(versionId: string): Promise<ResumeVersion> {
  if (isDemoMode()) return demo.getResume(versionId);
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/export/resume/${versionId}`,
  );
  return normalizeResumeVersion(unwrapResumeVersion(res.data));
}

/**
 * 아직 본문이 **만들어지는 중**인 레쥬메를 네트워크 장애·생성 실패와 구별해 말한다.
 *
 * 맨 `Error` 로 던지면 상세 화면의 에러 분기가 이것을 일반 실패로 뭉개, 정상적으로 생성
 * 중인 것을 "불러오지 못했어요"로 읽게 만든다(FRT-326). 자소서는 이미 전용 타입
 * `CoverLetterNotReadyError` 로 갈라 놓았다 - 같은 모양을 맞춘다.
 *
 * 판정을 **전용 타입으로만** 한다는 점이 요체다. 소거법("ApiError 가 아니면 준비 중")으로
 * 가르면 파싱 실패·네트워크 장애까지 "아직 만들고 있어요"가 되어, 사용자는 고칠 수 있는
 * 것을 못 고친 채 기다리기만 한다.
 */
export class ResumeNotReadyError extends Error {
  constructor() {
    super("resume result not ready");
    this.name = "ResumeNotReadyError";
  }
}

/**
 * 백엔드 GET /export/resume/{id} 는 본문을 data.result 한 겹에 감싸 돌려준다
 * (data = { id, title, language, status, created_at, updated_at, result }).
 * ResumeVersion 은 본문(인적사항/학력/경력…) 타입이므로 result 를 벗겨 반환한다.
 * 백엔드가 §3 result 규약 통일로 나중에 data 자체를 본문으로 평탄화해도 안 깨지도록
 * result 부재 시 data 그대로 폴백한다(dual-compat).
 */
function unwrapResumeVersion(data: unknown): ResumeVersion {
  if (data !== null && typeof data === "object") {
    const root = data as Record<string, unknown>;
    // 배열은 본문 레코드가 아니다. result:[] 를 큐잉/플레이스홀더 센티넬로 쓰는 백엔드가
    // 있으면 스프레드가 {} 로 뭉개져 meta 없는 껍데기를 ResumeVersion 으로 반환 → 상세
    // 페이지가 resume.meta.language 에서 크래시한다(이 함수가 막으려던 바로 그 실패).
    // 형제 언랩/가드(assertRenderableSchema·unwrapKeywordBody·unwrapList)와 동일하게 배열을 제외한다.
    if (
      root.result !== null &&
      typeof root.result === "object" &&
      !Array.isArray(root.result)
    ) {
      const content = root.result as ResumeVersion;
      // 래퍼의 id 를 본문 version_id 로 보존(본문에 없을 수 있음).
      if (content.version_id === undefined && typeof root.id === "string") {
        return { ...content, version_id: root.id };
      }
      return content;
    }
    // result 부재 = ① 백엔드가 §3 통일로 data 를 본문으로 평탄화(dual-compat) 또는
    // ② 아직 생성이 안 끝났거나 실패한 레쥬메 래퍼(result:null). 전자는 본문 마커
    // (meta)를 갖고 후자는 갖지 않는다. meta 없는 래퍼를 ResumeVersion 으로 반환하면
    // 상세 페이지가 resume.meta.language 에서 크래시하므로, 본문일 때만 폴백한다.
    // 본문이 아니면 아래에서 래퍼의 status 로 "만드는 중"과 "실패"를 다시 가른다.
    if (
      root.meta !== null &&
      typeof root.meta === "object" &&
      !Array.isArray(root.meta)
    ) {
      return root as unknown as ResumeVersion;
    }

    // 본문이 없다고 다 "만드는 중"은 아니다. 래퍼의 status 가 **끝났다**(success·failed)고
    // 말하는데 본문이 없으면 그건 실패다 — "다 만들어지면 다시 시도" 로 안내하면 영영 오지
    // 않을 완료를 기다리며 재시도만 누르게 된다. 끝났다는 **증거가 있을 때만** 실패로 가른다:
    // status 부재·미지 값은 증거가 아니므로 아래 준비 안 됨으로 떨어뜨린다(FRT-326 원래 증상 방지).
    const status = mapResumeStatus(root.status);
    if (status === "completed" || status === "failed") {
      throw new Error("resume result missing");
    }
  }
  throw new ResumeNotReadyError();
}

// 서버 응답: data = { count, contents: [{ id, created_at, updated_at }] }
export async function getResumeList(): Promise<ResumeListItem[]> {
  if (isDemoMode()) return demo.getResumeList();
  const res = await api.get<ApiSuccessResponse<unknown>>("/export/resume");
  const contents = readContents(res.data);

  return contents
    .map((item) => toListItem(item))
    .filter((item): item is ResumeListItem => item !== null);
}

// 래퍼가 벗겨진 배열로 오는 경우까지 받아둔다.
function readContents(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data === null || typeof data !== "object") return [];
  const contents = (data as Record<string, unknown>).contents;
  return Array.isArray(contents) ? contents : [];
}

function toListItem(raw: unknown): ResumeListItem | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" ? r.id : "";
  if (id === "") return null;

  const createdAt = typeof r.created_at === "string" ? r.created_at : "";
  const language = r.language === "ko" || r.language === "en" ? r.language : undefined;

  return {
    version_id: id,
    created_at: createdAt,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : createdAt,
    title: typeof r.title === "string" && r.title ? r.title : undefined,
    language,
    status: mapResumeStatus(r.status),
  };
}

export async function updateResume(
  versionId: string,
  data: ResumeVersion,
): Promise<ResumeVersion> {
  if (isDemoMode()) return demo.updateResume(versionId, data);
  // ⚠️ 본문은 **`result` 로 감싸서** 보낸다(BAC-56 `ResumePatchRequest{title?, result?}`).
  // 맨 ResumeVersion 을 보내면 두 필드 모두 미지정이 되는데, pydantic 기본이 extra="ignore"
  // 라 서버는 거절하지 않는다 — 아무것도 안 바꾼 채 200 과 **옛 본문**을 돌려준다.
  // 그러면 아래 언랩이 멀쩡히 성공해 호출부가 옛 본문을 initial 로 확정하고 draft 까지
  // 지운 뒤 "저장됐어요"를 띄운다. 조용한 편집 유실이 성공으로 위장되는 경로다.
  //
  // 실패는 **어느 것도 삼키지 않는다.** 서버에 PATCH 가 실재하므로(FRT-111) 상태코드는
  // 모두 진짜 사유다 — 422 는 검증 실패, 400 은 생성 미완료. 골라 삼킬수록 화면이
  // "왜 안 되는지"를 말하지 못하고 사용자는 고칠 수 있는 것을 못 고친 채 재시도만 한다.
  const res = await api.patch<ApiSuccessResponse<unknown>>(
    `/export/resume/${versionId}`,
    { result: data },
  );

  // PATCH 도 GET 과 같은 래퍼({id, title, language, status, …, result})를 돌려준다
  // (`patch_resume` 이 `get_resume` 과 같은 `ResumeResponse` 를 반환한다).
  // 그대로 반환하면 호출부가 본문 대신 래퍼를 상태에 넣어 resume.meta.language 에서
  // 크래시한다. GET 과 같은 경계 처리를 태워 본문만, 정규화된 채로 돌려준다.
  //
  // 언랩이 실패하면 그대로 던진다 — 여기서 요청 본문을 되돌려주며 성공인 척하면
  // "저장됐어요"가 뜨고 임시 저장까지 지워진 채 서버엔 아무것도 안 남는다.
  // 실패로 흘려보내야 호출부가 편집을 임시 저장으로 붙든다.
  return normalizeResumeVersion(unwrapResumeVersion(res.data));
}

export async function deleteResume(versionId: string): Promise<void> {
  if (isDemoMode()) return demo.deleteResume(versionId);
  await api.delete<void>(`/export/resume/${versionId}`);
}
