"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getExperiences,
  getExperience,
  createExperience as apiCreateExperience,
  updateExperience as apiUpdateExperience,
  updateExperienceImportance as apiUpdateExperienceImportance,
  deleteExperience as apiDeleteExperience,
  duplicateExperience as apiDuplicateExperience,
} from "@/lib/api/experience-api";
import type {
  ExperienceListData,
  ExperienceSavePayload,
  ExperienceUpdatePayload,
} from "@/types/experience";

const EMPTY_LIST: ExperienceListData = { count: 0, contents: [] };

export function useExperiences() {
  // 목록과 개수는 **한 상태**다 — 따로 두면 "정말 새로 넣었는가"를 목록 업데이터의
  // 부수효과로 판정하고 개수는 그 밖에서 올리게 되는데, React 가 업데이터를 dispatch
  // 시점에 동기 실행해 준다는 보장은 조건부라 판정이 통째로 유실된다(FRT-237).
  // 한 업데이터 안에서 함께 움직이면 그 어긋남 자체가 표현 불가능해진다.
  const [list, setList] = useState<ExperienceListData>(EMPTY_LIST);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(false);
  const lifecycleRef = useRef(0);
  const requestRef = useRef(0);
  // List snapshots and non-duplicate writes invalidate pending item hydration.
  // Duplicate hydrations do not invalidate one another: each adds a distinct copy.
  const snapshotRef = useRef(0);
  const hasSnapshotRef = useRef(false);

  const load = useCallback(async () => {
    if (!mountedRef.current) return;
    const request = ++requestRef.current;
    try {
      const data = await getExperiences();
      if (!mountedRef.current || request !== requestRef.current) return;
      snapshotRef.current += 1;
      hasSnapshotRef.current = true;
      setList({ count: data.count, contents: data.contents });
      setIsLoading(false);
    } catch (err) {
      if (!mountedRef.current || request !== requestRef.current) return;
      setError(err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."));
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    setError(null);
    await load();
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    // load only commits state after its network await; initial loading is already true.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      mountedRef.current = false;
      lifecycleRef.current += 1;
      requestRef.current += 1;
      snapshotRef.current += 1;
    };
  }, [load]);

  const createExperience = useCallback(
    async (payload: ExperienceSavePayload): Promise<string> => {
      const lifecycle = lifecycleRef.current;
      const newId = await apiCreateExperience(payload);
      if (!mountedRef.current || lifecycle !== lifecycleRef.current) return newId;
      snapshotRef.current += 1;
      await refetch();
      return newId;
    },
    [refetch],
  );

  const updateExperience = useCallback(
    async (id: string, payload: ExperienceUpdatePayload): Promise<void> => {
      const lifecycle = lifecycleRef.current;
      await apiUpdateExperience(id, payload);
      if (!mountedRef.current || lifecycle !== lifecycleRef.current) return;
      snapshotRef.current += 1;
      await refetch();
    },
    [refetch],
  );

  const updateImportance = useCallback(
    async (id: string, importance: number | null): Promise<void> => {
      const lifecycle = lifecycleRef.current;
      await apiUpdateExperienceImportance(id, importance);
      if (!mountedRef.current || lifecycle !== lifecycleRef.current) return;
      snapshotRef.current += 1;
      await refetch();
    },
    [refetch],
  );

  const deleteExperience = useCallback(
    async (id: string): Promise<void> => {
      const lifecycle = lifecycleRef.current;
      await apiDeleteExperience(id);
      if (!mountedRef.current || lifecycle !== lifecycleRef.current) return;
      snapshotRef.current += 1;
      await refetch();
    },
    [refetch],
  );

  const duplicateExperience = useCallback(
    async (id: string): Promise<string> => {
      const lifecycle = lifecycleRef.current;
      const newId = await apiDuplicateExperience(id);
      if (!mountedRef.current || lifecycle !== lifecycleRef.current) return newId;
      // A successful write supersedes any GET started before it.
      requestRef.current += 1;
      const snapshot = snapshotRef.current;
      const ownsHydration = () => mountedRef.current
        && lifecycle === lifecycleRef.current
        && snapshot === snapshotRef.current;
      setIsLoading(false);
      setError(null);
      // POST succeeded — the server-side record exists. The follow-up fetch is
      // best-effort hydration so selection works before the list refresh; a
      // failure here must not make the caller think duplication failed and
      // retry, which would create multiple copies.
      try {
        const created = await getExperience(newId);
        if (!ownsHydration()) return newId;
        setList((prev) => {
          // 새로고침이 먼저 실어 왔을 수 있다 — 그때는 목록도 개수도 건드리지 않는다.
          if (prev.contents.some((e) => e.id === created.id)) return prev;
          return { count: prev.count + 1, contents: [created, ...prev.contents] };
        });
        // If duplication superseded the initial load, recover the complete list
        // rather than leaving only the hydrated copy and an incomplete count.
        if (!hasSnapshotRef.current) await refetch();
      } catch {
        if (!ownsHydration()) return newId;
        try {
          await refetch();
        } catch {
          // Best-effort list refresh — swallow so a transient GET failure
          // doesn't surface as a write failure and invite retries that create duplicates.
        }
      }
      return newId;
    },
    [refetch],
  );

  return {
    experiences: list.contents,
    count: list.count,
    isLoading,
    error,
    refetch,
    createExperience,
    updateExperience,
    updateImportance,
    deleteExperience,
    duplicateExperience,
  };
}
