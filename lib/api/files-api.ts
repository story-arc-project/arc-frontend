"use client";

import { api, ApiError } from "./client";
import type { ApiSuccessResponse } from "@/types/api";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/",
  "text/",
] as const;

export interface UploadedFile {
  id: string;
  url?: string;
  mimeType: string;
  size: number;
  originalName: string;
}

export interface FileUrlInfo {
  url: string;
  expiresAt?: string;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

interface PresignData {
  id: string;
  upload_url: string;
  expires_in: number;
}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return `파일이 너무 커요. 최대 ${mb}MB까지 업로드할 수 있어요.`;
  }
  if (file.type && !isAllowedMime(file.type)) {
    return "지원하지 않는 파일 형식이에요.";
  }
  return null;
}

// presign PUT은 크로스-오리진 스토리지로 직접 전송된다 — 쿠키 미포함, Content-Type은 서명된 타입과 일치해야 한다.
function putToStorage(
  uploadUrl: string,
  file: File,
  contentType: string,
  opts: UploadOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new ApiError(0, "업로드가 취소됐어요.", "aborted"));
      return;
    }

    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.withCredentials = false;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !opts.onProgress) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      opts.onProgress(pct);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiError(xhr.status, "업로드에 실패했어요."));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError(0, "네트워크 오류로 업로드에 실패했어요."));
    };

    xhr.onabort = () => {
      reject(new ApiError(0, "업로드가 취소됐어요.", "aborted"));
    };

    if (opts.signal) {
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

function pickUrl(raw: Record<string, unknown>): string | undefined {
  const data =
    raw.data !== undefined && typeof raw.data === "object" && raw.data !== null
      ? (raw.data as Record<string, unknown>)
      : null;

  if (data) {
    if (typeof data.url === "string") return data.url;
    if (typeof data.download_url === "string") return data.download_url;
  }
  if (typeof raw.url === "string") return raw.url;
  if (typeof raw.download_url === "string") return raw.download_url;
  return undefined;
}

function pickExpiresAt(raw: Record<string, unknown>): string | undefined {
  const data =
    raw.data !== undefined && typeof raw.data === "object" && raw.data !== null
      ? (raw.data as Record<string, unknown>)
      : null;

  if (data) {
    if (typeof data.expires_at === "string") return data.expires_at;
    if (typeof data.expiresAt === "string") return data.expiresAt;
  }
  if (typeof raw.expires_at === "string") return raw.expires_at;
  if (typeof raw.expiresAt === "string") return raw.expiresAt;
  return undefined;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === "AbortError";
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "AbortError"
  );
}

export async function uploadFile(
  file: File,
  opts: UploadOptions = {},
): Promise<UploadedFile> {
  const validationError = validateFile(file);
  if (validationError) {
    throw new ApiError(400, validationError, "invalid_file");
  }

  if (opts.signal?.aborted) {
    throw new ApiError(0, "업로드가 취소됐어요.", "aborted");
  }

  const contentType = file.type || "application/octet-stream";

  const presignRes = await api.post<ApiSuccessResponse<PresignData>>(
    "/files/presign",
    { filename: file.name, content_type: contentType, size: file.size },
  );

  const presignData = presignRes.data;
  if (
    typeof presignData?.id !== "string" ||
    typeof presignData?.upload_url !== "string"
  ) {
    throw new ApiError(500, "업로드 준비 응답 형식이 올바르지 않아요.");
  }

  await putToStorage(presignData.upload_url, file, contentType, opts);

  // presign 이후 abort 가 도착했다면 confirm 전에 차단
  if (opts.signal?.aborted) {
    throw new ApiError(0, "업로드가 취소됐어요.", "aborted");
  }

  try {
    await api.post("/files/confirm", { id: presignData.id }, { signal: opts.signal });
  } catch (err) {
    if (isAbortError(err)) {
      throw new ApiError(0, "업로드가 취소됐어요.", "aborted");
    }
    throw err;
  }

  return {
    id: presignData.id,
    mimeType: contentType,
    size: file.size,
    originalName: file.name,
    url: undefined,
  };
}

export async function getFileUrl(id: string): Promise<FileUrlInfo> {
  const res = await api.get<unknown>(`/files/${id}/download`);
  const raw = res as Record<string, unknown>;

  const url = pickUrl(raw);
  if (!url) {
    throw new ApiError(500, "파일 URL 응답 형식이 올바르지 않아요.");
  }

  return { url, expiresAt: pickExpiresAt(raw) };
}

export async function deleteFile(id: string): Promise<void> {
  await api.delete(`/files/${id}`);
}
