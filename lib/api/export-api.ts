import { api, ApiError } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  ResumeLanguage,
  ResumeListItem,
  ResumeVersion,
} from "@/types/resume";

// ─── Resume endpoints ──────────────────────────────────────────────

export async function createResume(
  params: { language: ResumeLanguage },
  options?: { signal?: AbortSignal },
): Promise<ResumeVersion> {
  const res = await api.post<ApiSuccessResponse<ResumeVersion>>(
    "/export/resume",
    { language: params.language },
    options,
  );
  return res.data;
}

export async function getResume(versionId: string): Promise<ResumeVersion> {
  const res = await api.get<ApiSuccessResponse<ResumeVersion>>(
    `/export/resume/${versionId}`,
  );
  return res.data;
}

// Accept both the slim list shape and the full-payload shape. When the
// backend returns full ResumeVersion objects, extract the fields we need.
export async function getResumeList(): Promise<ResumeListItem[]> {
  const res = await api.get<ApiSuccessResponse<unknown>>("/export/resume");
  const data = res.data;

  if (!Array.isArray(data)) return [];

  return data.map((item) => toListItem(item)).filter((item) => item.version_id !== "");
}

function toListItem(raw: unknown): ResumeListItem {
  const r = raw as Record<string, unknown>;

  const versionId = (r.version_id as string | undefined) ?? "";
  const metaRaw = (r.meta as Record<string, unknown> | undefined) ?? {};

  const rawLang =
    (r.language as string | undefined) ??
    (metaRaw.language as string | undefined);
  const language: ResumeLanguage = rawLang === "en" ? "en" : "ko";

  const generatedAt =
    (r.generated_at as string | undefined) ??
    (metaRaw.generated_at as string | undefined) ??
    "";

  const summaryPreview =
    (r.summary_preview as string | undefined) ??
    sliceSummary(r.자기소개_요약 as string | null | undefined);

  return {
    version_id: versionId,
    language,
    generated_at: generatedAt,
    summary_preview: summaryPreview ?? null,
  };
}

function sliceSummary(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const trimmed = summary.trim();
  if (!trimmed) return null;
  return trimmed.length > 50 ? `${trimmed.slice(0, 50)}…` : trimmed;
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
  return err instanceof ApiError && (err.status === 404 || err.status === 501 || err.status === 405);
}

export async function updateResume(
  versionId: string,
  data: ResumeVersion,
): Promise<ResumeVersion> {
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
  try {
    await api.delete<void>(`/export/resume/${versionId}`);
  } catch (err) {
    if (isUnsupportedStatus(err)) {
      throw new ResumeMutationUnsupportedError(err.status);
    }
    throw err;
  }
}
