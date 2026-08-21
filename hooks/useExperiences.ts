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

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getExperiences();
      if (!mountedRef.current) return;
      setList({ count: data.count, contents: data.contents });
      setIsLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."));
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getExperiences();
        if (cancelled) return;
        setList({ count: data.count, contents: data.contents });
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."));
        setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const createExperience = useCallback(
    async (payload: ExperienceSavePayload): Promise<string> => {
      const newId = await apiCreateExperience(payload);
      await refetch();
      return newId;
    },
    [refetch],
  );

  const updateExperience = useCallback(
    async (id: string, payload: ExperienceUpdatePayload): Promise<void> => {
      await apiUpdateExperience(id, payload);
      await refetch();
    },
    [refetch],
  );

  const updateImportance = useCallback(
    async (id: string, importance: number | null): Promise<void> => {
      await apiUpdateExperienceImportance(id, importance);
      await refetch();
    },
    [refetch],
  );

  const deleteExperience = useCallback(
    async (id: string): Promise<void> => {
      await apiDeleteExperience(id);
      await refetch();
    },
    [refetch],
  );

  const duplicateExperience = useCallback(
    async (id: string): Promise<string> => {
      const newId = await apiDuplicateExperience(id);
      // POST succeeded — the server-side record exists. The follow-up fetch is
      // best-effort hydration so selection works before the list refresh; a
      // failure here must not make the caller think duplication failed and
      // retry, which would create multiple copies.
      try {
        const created = await getExperience(newId);
        setList((prev) => {
          // 새로고침이 먼저 실어 왔을 수 있다 — 그때는 목록도 개수도 건드리지 않는다.
          if (prev.contents.some((e) => e.id === created.id)) return prev;
          return { count: prev.count + 1, contents: [created, ...prev.contents] };
        });
      } catch {
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
