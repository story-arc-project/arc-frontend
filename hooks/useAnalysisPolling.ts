"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getComprehensiveList,
  getKeywordList,
} from "@/lib/api/analysis-api";
import type { AnalysisSnapshot, AnalysisType } from "@/types/analysis";

const MAX_RETRIES = 20;
const POLL_INTERVAL_MS = 3_000;
const MAX_CONSECUTIVE_ERRORS = 3;

type PollableType = Exclude<AnalysisType, "individual">;

interface UseAnalysisPollingOptions {
  analysisId: string | null;
  type: PollableType;
  redirectPath: string;
  onFailed: (msg: string) => void;
  onTimeout: (msg: string) => void;
}

async function fetchSnapshotStatus(
  type: PollableType,
  id: string,
): Promise<AnalysisSnapshot | undefined> {
  const list =
    type === "comprehensive" ? await getComprehensiveList() : await getKeywordList();
  return list.find((s) => s.id === id);
}

export default function useAnalysisPolling({
  analysisId,
  type,
  redirectPath,
  onFailed,
  onTimeout,
}: UseAnalysisPollingOptions) {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [polling, setPolling] = useState(false);

  // Use refs for callbacks to avoid stale closures and prevent
  // `start` from being recreated on every render
  const onFailedRef = useRef(onFailed);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onFailedRef.current = onFailed; }, [onFailed]);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  const start = useCallback(() => {
    if (!analysisId) return;
    setPolling(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      let consecutiveErrors = 0;
      let consecutiveNotFound = 0;
      const MAX_NOT_FOUND = 5;
      for (let i = 0; i < MAX_RETRIES; i++) {
        if (controller.signal.aborted) return;
        try {
          const snapshot = await fetchSnapshotStatus(type, analysisId);
          if (controller.signal.aborted) return;
          consecutiveErrors = 0;
          if (!snapshot) {
            consecutiveNotFound++;
            if (consecutiveNotFound >= MAX_NOT_FOUND) {
              setPolling(false);
              onFailedRef.current("분석 결과를 찾을 수 없습니다. 다시 시도해주세요.");
              return;
            }
          } else {
            consecutiveNotFound = 0;
            const status = snapshot.status;
            if (status === "completed") {
              setPolling(false);
              router.push(`${redirectPath}/${analysisId}`);
              return;
            }
            if (status === "failed") {
              setPolling(false);
              onFailedRef.current("분석에 실패했습니다. 다시 시도해주세요.");
              return;
            }
          }
        } catch {
          if (controller.signal.aborted) return;
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            setPolling(false);
            onFailedRef.current("분석 상태 확인에 실패했습니다.");
            return;
          }
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, POLL_INTERVAL_MS);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });
        });
      }
      if (!controller.signal.aborted) {
        setPolling(false);
        onTimeoutRef.current("분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
      }
    })();
  }, [analysisId, type, redirectPath, router]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { start, polling };
}
