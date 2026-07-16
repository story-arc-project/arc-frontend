import { api, ApiError } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  ResumeLanguage,
  ResumeListItem,
  ResumeVersion,
} from "@/types/resume";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

// ─── Resume endpoints ──────────────────────────────────────────────

// 생성은 큐잉만 한다 — 서버는 생성된 id 를 돌려주지 않으므로 반환값이 없다.
// 완료 여부는 목록을 다시 조회해 확인한다.
export async function createResume(
  params: { language: ResumeLanguage },
  options?: { signal?: AbortSignal },
): Promise<void> {
  if (isDemoMode()) return demo.createResume(params);
  await api.post<ApiSuccessResponse<unknown>>(
    "/export/resume",
    { language: params.language },
    options,
  );
}

export async function getResume(versionId: string): Promise<ResumeVersion> {
  if (isDemoMode()) return demo.getResume(versionId);
  const res = await api.get<ApiSuccessResponse<ResumeVersion>>(
    `/export/resume/${versionId}`,
  );
  return res.data;
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

  return {
    version_id: id,
    created_at: createdAt,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : createdAt,
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
