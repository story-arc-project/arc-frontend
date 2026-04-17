"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getExperiences,
  getExperience,
  createExperience as apiCreateExperience,
  updateExperience as apiUpdateExperience,
  deleteExperience as apiDeleteExperience,
  duplicateExperience as apiDuplicateExperience,
} from "@/lib/api/experience-api";
import type { Experience, ExperienceSavePayload, ExperienceUpdatePayload } from "@/types/experience";

export function useExperiences() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
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
      setExperiences(data.contents);
      setCount(data.count);
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
        setExperiences(data.contents);
        setCount(data.count);
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
    async (payload: ExperienceSavePayload): Promise<Experience> => {
      const created = await apiCreateExperience(payload);
      await refetch();
      return created;
    },
    [refetch],
  );

  const updateExperience = useCallback(
    async (id: string, payload: ExperienceUpdatePayload): Promise<Experience> => {
      const updated = await apiUpdateExperience(id, payload);
      await refetch();
      return updated;
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
        let inserted = false;
        setExperiences((prev) => {
          if (prev.some((e) => e.id === created.id)) return prev;
          inserted = true;
          return [created, ...prev];
        });
        if (inserted) setCount((c) => c + 1);
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
    experiences,
    count,
    isLoading,
    error,
    refetch,
    createExperience,
    updateExperience,
    deleteExperience,
    duplicateExperience,
  };
}
