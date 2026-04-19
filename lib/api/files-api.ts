"use client";

import { api, ApiError } from "./client";
import type { ApiSuccessResponse } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

interface RawUploadResponse {
  id: string;
  url?: string;
  mime_type?: string;
  mimeType?: string;
  size: number;
  original_name?: string;
  originalName?: string;
}

function normalizeUploaded(raw: RawUploadResponse): UploadedFile {
  return {
    id: raw.id,
    url: raw.url,
    mimeType: raw.mimeType ?? raw.mime_type ?? "application/octet-stream",
    size: raw.size,
    originalName: raw.originalName ?? raw.original_name ?? "",
  };
}

function isAllowedMime(mime: string): boolean {
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

async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

interface XhrResult {
  status: number;
  body: string;
}

function xhrUpload(
  file: File,
  opts: UploadOptions,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", `${API_URL}/files/upload`, true);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !opts.onProgress) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      opts.onProgress(pct);
    };

    xhr.onload = () => {
      resolve({ status: xhr.status, body: xhr.responseText });
    };

    xhr.onerror = () => {
      reject(new ApiError(0, "네트워크 오류로 업로드에 실패했어요."));
    };

    xhr.onabort = () => {
      reject(new ApiError(0, "업로드가 취소됐어요.", "aborted"));
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}

function parseUploadResponse(
  status: number,
  body: string,
): UploadedFile {
  let parsed: unknown = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }

  if (status >= 200 && status < 300) {
    if (!parsed || typeof parsed !== "object") {
      throw new ApiError(status, "업로드 응답을 해석할 수 없어요.");
    }
    const wrapper = parsed as Partial<ApiSuccessResponse<RawUploadResponse>> &
      Partial<RawUploadResponse>;
    const raw = wrapper.data ?? (parsed as RawUploadResponse);
    if (!raw || typeof raw.id !== "string") {
      throw new ApiError(status, "업로드 응답 형식이 올바르지 않아요.");
    }
    return normalizeUploaded(raw);
  }

  const errBody =
    parsed && typeof parsed === "object"
      ? (parsed as { message?: string; code?: string })
      : {};
  throw new ApiError(
    status,
    errBody.message ?? "업로드에 실패했어요.",
    errBody.code,
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

  const first = await xhrUpload(file, opts);
  if (first.status !== 401) {
    return parseUploadResponse(first.status, first.body);
  }

  const refreshed = await tryRefresh();
  if (!refreshed) {
    throw new ApiError(401, "인증이 만료되었어요. 다시 로그인해주세요.");
  }

  const second = await xhrUpload(file, opts);
  return parseUploadResponse(second.status, second.body);
}

export async function deleteFile(id: string): Promise<void> {
  await api.delete<void>(`/files/${id}`);
}

export async function getFileUrl(id: string): Promise<FileUrlInfo> {
  const res = await api.get<ApiSuccessResponse<FileUrlInfo>>(`/files/${id}`);
  return res.data;
}
