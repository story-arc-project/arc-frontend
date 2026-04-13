"use client";

import { useCallback, useEffect, useState } from "react";

import { getExperience } from "@/lib/api/experience-api";
import type { Experience } from "@/types/experience";

export function useExperience(id: string | null) {
  const [experience, setExperience] = useState<Experience | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getExperience(id);
      setExperience(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      refetch();
    } else {
      setExperience(null);
      setIsLoading(false);
      setError(null);
    }
  }, [id, refetch]);

  return {
    experience,
    isLoading,
    error,
    refetch,
  };
}
