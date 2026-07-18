import { api, ApiError } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { AnalysisStatus } from "@/types/analysis";
import type {
  ResumeLanguage,
  ResumeListItem,
  ResumeVersion,
} from "@/types/resume";
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
  params: { language: ResumeLanguage; title?: string },
  options?: { signal?: AbortSignal },
): Promise<{ id: string | null; title?: string }> {
  if (isDemoMode()) {
    await demo.createResume(params);
    return { id: null };
  }
  const body: Record<string, unknown> = { language: params.language };
  if (params.title !== undefined) body.title = params.title;
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
  return unwrapResumeVersion(res.data);
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
    if (root.result !== null && typeof root.result === "object") {
      const content = root.result as ResumeVersion;
      // 래퍼의 id 를 본문 version_id 로 보존(본문에 없을 수 있음).
      if (content.version_id === undefined && typeof root.id === "string") {
        return { ...content, version_id: root.id };
      }
      return content;
    }
  }
  return data as ResumeVersion;
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

// Server-side PATCH / DELETE are pending. Callers can catch this error and
// fall back to localStorage draft flow.
export class ResumeMutationUnsupportedError extends Error {
  constructor(readonly status: number) {
    super("resume mutation not supported yet");
    this.name = "ResumeMutationUnsupportedError";
  }
}

function isUnsupportedStatus(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.status === 501 || err.status === 405);
}

export async function updateResume(
  versionId: string,
  data: ResumeVersion,
): Promise<ResumeVersion> {
  if (isDemoMode()) return demo.updateResume(versionId, data);
  try {
    const res = await api.patch<ApiSuccessResponse<ResumeVersion>>(
      `/export/resume/${versionId}`,
      data,
    );
    return res.data;
  } catch (err) {
    if (isUnsupportedStatus(err)) {
      throw new ResumeMutationUnsupportedError(err.status);
    }
    throw err;
  }
}

export async function deleteResume(versionId: string): Promise<void> {
  if (isDemoMode()) return demo.deleteResume(versionId);
  try {
    await api.delete<void>(`/export/resume/${versionId}`);
  } catch (err) {
    if (isUnsupportedStatus(err)) {
      throw new ResumeMutationUnsupportedError(err.status);
    }
    throw err;
  }
}
