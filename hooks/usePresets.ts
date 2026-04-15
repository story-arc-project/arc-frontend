"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createPreset as apiCreatePreset,
  deletePreset as apiDeletePreset,
  duplicatePreset as apiDuplicatePreset,
  getPresets as apiGetPresets,
  updatePreset as apiUpdatePreset,
} from "@/lib/api/preset-api";
import { toPreset } from "@/lib/utils/preset-mapper";
import type { Block, ExperienceTypeId, Preset } from "@/types/archive";

export interface UsePresetsReturn {
  presets: Preset[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createPreset: (
    name: string,
    blocks: Block[],
    opts?: { description?: string; recommendedTypeIds?: ExperienceTypeId[] },
  ) => Promise<void>;
  updatePreset: (
    id: string,
    updates: Partial<
      Pick<Preset, "name" | "description" | "recommendedTypeIds" | "isFavorite" | "blocks">
    >,
  ) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  duplicatePreset: (id: string) => Promise<void>;
  getPreset: (id: string) => Preset | undefined;
}

export function usePresets(): UsePresetsReturn {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const refetchVersionRef = useRef(0);

  const refetch = useCallback(async () => {
    const version = ++refetchVersionRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const dtos = await apiGetPresets();
      if (version !== refetchVersionRef.current) return;
      setPresets(dtos.map(toPreset));
    } catch (err) {
      if (version !== refetchVersionRef.current) return;
      setError(err instanceof Error ? err : new Error("프리셋을 불러오지 못했어요."));
    } finally {
      if (version === refetchVersionRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createPreset = useCallback(
    async (
      name: string,
      blocks: Block[],
      opts?: { description?: string; recommendedTypeIds?: ExperienceTypeId[] },
    ): Promise<void> => {
      try {
        const dto = await apiCreatePreset({
          name,
          description: opts?.description,
          recommendedTypeIds: opts?.recommendedTypeIds,
          blocks,
          isFavorite: false,
        });
        setPresets((prev) => [...prev, toPreset(dto)]);
      } catch (err) {
        await refetch();
        throw err;
      }
    },
    [refetch],
  );

  const updatePreset = useCallback(
    async (
      id: string,
      updates: Partial<
        Pick<Preset, "name" | "description" | "recommendedTypeIds" | "isFavorite" | "blocks">
      >,
    ): Promise<void> => {
      const snapshot = presets;
      setPresets((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
        ),
      );
      try {
        const dto = await apiUpdatePreset(id, updates);
        setPresets((prev) => prev.map((p) => (p.id === id ? toPreset(dto) : p)));
      } catch (err) {
        setPresets(snapshot);
        throw err;
      }
    },
    [presets],
  );

  const deletePreset = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = presets;
      setPresets((prev) => prev.filter((p) => p.id !== id));
      try {
        await apiDeletePreset(id);
      } catch (err) {
        setPresets(snapshot);
        throw err;
      }
    },
    [presets],
  );

  const duplicatePreset = useCallback(
    async (id: string): Promise<void> => {
      try {
        await apiDuplicatePreset(id);
        await refetch();
      } catch (err) {
        throw err;
      }
    },
    [refetch],
  );

  const getPreset = useCallback(
    (id: string) => presets.find((p) => p.id === id),
    [presets],
  );

  return {
    presets,
    isLoading,
    error,
    refetch,
    createPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    getPreset,
  };
}
