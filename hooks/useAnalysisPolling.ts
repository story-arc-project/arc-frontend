"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getAnalysisStatus } from "@/lib/analysis-api";

const MAX_RETRIES = 20;
const POLL_INTERVAL_MS = 3_000;

interface UseAnalysisPollingOptions {
  analysisId: string | null;
  redirectPath: string;
  onFailed: (msg: string) => void;
  onTimeout: (msg: string) => void;
}

export default function useAnalysisPolling({
  analysisId,
  redirectPath,
  onFailed,
  onTimeout,
}: UseAnalysisPollingOptions) {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [polling, setPolling] = useState(false);

  const start = useCallback(() => {
    if (!analysisId) return;
    setPolling(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      for (let i = 0; i < MAX_RETRIES; i++) {
        if (controller.signal.aborted) return;
        try {
          const { status } = await getAnalysisStatus(analysisId);
          if (controller.signal.aborted) return;
          if (status === "completed") {
            router.push(`${redirectPath}/${analysisId}`);
            return;
          }
          if (status === "failed") {
            setPolling(false);
            onFailed("분석에 실패했습니다. 다시 시도해주세요.");
            return;
          }
        } catch {
          if (controller.signal.aborted) return;
          setPolling(false);
          onFailed("분석 상태 확인에 실패했습니다.");
          return;
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, POLL_INTERVAL_MS);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
      if (!controller.signal.aborted) {
        setPolling(false);
        onTimeout("분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
      }
    })();
  }, [analysisId, redirectPath, onFailed, onTimeout, router]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { start, polling };
}
