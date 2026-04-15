"use client";

import { useCallback, useEffect, useState } from "react";

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

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getExperiences();
      setExperiences(data.contents);
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

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
      // Fetch the new record directly so selection works even if the list
      // refresh fails or is delayed. A failing list refresh must not silently
      // leave the caller with an id that is missing from local state.
      const created = await getExperience(newId);
      setExperiences((prev) => {
        if (prev.some((e) => e.id === created.id)) return prev;
        return [created, ...prev];
      });
      setCount((c) => c + 1);
      return newId;
    },
    [],
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
