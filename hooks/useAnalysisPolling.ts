"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getComprehensiveList,
  getKeywordList,
} from "@/lib/api/analysis-api";
import { capture } from "@/lib/analytics";
import type { FeedbackContext } from "@/lib/feedback/types";
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
  /**
   * 분석이 완료된 순간, 결과 화면으로 이동하기 **직전**에 부른다(FRT-95 피드백 트리거).
   * 완료와 동시에 이 화면은 언마운트되므로, 완료 사실을 화면 밖으로 내보낼 유일한 지점이다.
   */
  onCompleted?: (context: FeedbackContext) => void;
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
  onCompleted,
}: UseAnalysisPollingOptions) {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [polling, setPolling] = useState(false);

  // Use refs for callbacks to avoid stale closures and prevent
  // `start` from being recreated on every render
  const onFailedRef = useRef(onFailed);
  const onTimeoutRef = useRef(onTimeout);
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => { onFailedRef.current = onFailed; }, [onFailed]);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);
  useEffect(() => { onCompletedRef.current = onCompleted; }, [onCompleted]);

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
              // 분석 실행 완료 확정 지점(FRT-19). type 은 comprehensive|keyword.
              // 개별(individual) 분석은 자동 생성이라 이 폴링 대상이 아니다.
              capture("analysis_completed", { analysis_type: type });
              // 이동 직전에 알린다 — push 뒤엔 이 화면이 사라져 신호를 낼 기회가 없다.
              onCompletedRef.current?.({ analysisId, analysisType: type });
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
