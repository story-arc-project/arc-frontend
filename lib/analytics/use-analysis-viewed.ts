"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { capture, getAnalyticsEpoch, isAnalyticsEpochCurrent } from "./client";
import type { ViewableAnalysisKind } from "./events";
import { useExitSignal } from "./exit-signal";

export interface AnalysisViewedOptions {
  analysisType: ViewableAnalysisKind;
  analysisId: string;
  ready: boolean;
}

export interface AnalysisViewObservation {
  analysis_id: string;
  analysis_type: ViewableAnalysisKind;
  view_id: string;
  viewed_at: string;
  epoch: number;
}

export function useAnalysisViewed({ analysisType, analysisId, ready }: AnalysisViewedOptions): AnalysisViewObservation | undefined {
  const session = useMemo(() => ({ epoch: getAnalyticsEpoch(), analysisId, analysisType }), [analysisId, analysisType]);
  const [observed, setObserved] = useState<{ session: typeof session; view: AnalysisViewObservation }>();
  const observedSession = useRef<typeof session | undefined>(undefined);

  useEffect(() => {
    const observe = () => {
      if (!ready || observedSession.current === session || document.visibilityState !== "visible" || !isAnalyticsEpochCurrent(session.epoch)) return;
      const view = { analysis_id: analysisId, analysis_type: analysisType, view_id: crypto.randomUUID(), viewed_at: new Date().toISOString(), epoch: session.epoch };
      observedSession.current = session;
      const properties = { analysis_id: view.analysis_id, analysis_type: view.analysis_type, view_id: view.view_id, viewed_at: view.viewed_at };
      capture("analysis_result_viewed", { ...properties, schema_version: 2, source: "browser" });
      setObserved({ session, view });
    };
    observe();
    document.addEventListener("visibilitychange", observe);
    return () => document.removeEventListener("visibilitychange", observe);
  }, [analysisId, analysisType, ready, session]);

  // Preserve legacy dwell and flush-on-logout behavior, while isolating route reuse.
  useExitSignal({
    active: ready,
    sessionKey: `${analysisType}:${analysisId}`,
    onHidden: true,
    shouldFire: () => isAnalyticsEpochCurrent(session.epoch),
    onFire: (seconds) => capture("analysis_viewed", { analysis_type: analysisType, analysis_id: analysisId, view_duration_seconds: seconds }, { atUnload: true }),
  });
  return observed?.session === session && isAnalyticsEpochCurrent(session.epoch) ? observed.view : undefined;
}
