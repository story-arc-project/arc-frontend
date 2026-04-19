"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { uploadFile, type UploadedFile } from "@/lib/api/files-api";
import { ApiError } from "@/lib/api/client";

export type UploadState = "idle" | "uploading" | "success" | "error";

export interface UseFileUploadResult {
  state: UploadState;
  progress: number;
  error: string | null;
  start: (file: File) => Promise<UploadedFile | null>;
  cancel: () => void;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadResult {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const start = useCallback(async (file: File): Promise<UploadedFile | null> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState("uploading");
    setProgress(0);
    setError(null);

    try {
      const uploaded = await uploadFile(file, {
        signal: controller.signal,
        onProgress: (pct) => {
          if (mountedRef.current) setProgress(pct);
        },
      });
      if (!mountedRef.current) return uploaded;
      setState("success");
      setProgress(100);
      return uploaded;
    } catch (err) {
      if (!mountedRef.current) return null;
      if (err instanceof ApiError && err.code === "aborted") {
        setState("idle");
        setProgress(0);
        setError(null);
        return null;
      }
      const message =
        err instanceof Error ? err.message : "업로드 중 오류가 발생했어요.";
      setState("error");
      setError(message);
      return null;
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState("idle");
    setProgress(0);
    setError(null);
  }, []);

  return { state, progress, error, start, cancel, reset };
}
