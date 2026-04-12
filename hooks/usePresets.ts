"use client"

import { useState, useCallback } from "react"
import type { Preset, Block, ExperienceTypeId } from "@/types/archive"
import { uid, cloneBlocks } from "@/lib/block-utils"

export interface UsePresetsReturn {
  presets: Preset[]
  createPreset: (name: string, blocks: Block[], opts?: { description?: string; recommendedTypeIds?: ExperienceTypeId[] }) => void
  updatePreset: (id: string, updates: Partial<Pick<Preset, "name" | "description" | "recommendedTypeIds" | "isFavorite">>) => void
  deletePreset: (id: string) => void
  duplicatePreset: (id: string) => void
  getPreset: (id: string) => Preset | undefined
}

export function usePresets(): UsePresetsReturn {
  const [presets, setPresets] = useState<Preset[]>([])

  const createPreset = useCallback(
    (
      name: string,
      blocks: Block[],
      opts?: { description?: string; recommendedTypeIds?: ExperienceTypeId[] }
    ) => {
      const now = new Date().toISOString()
      const preset: Preset = {
        id: uid("preset"),
        name,
        description: opts?.description,
        recommendedTypeIds: opts?.recommendedTypeIds,
        blocks: cloneBlocks(blocks),
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      }
      setPresets(prev => [...prev, preset])
    },
    []
  )

  const updatePreset = useCallback(
    (id: string, updates: Partial<Pick<Preset, "name" | "description" | "recommendedTypeIds" | "isFavorite">>) => {
      setPresets(prev =>
        prev.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        )
      )
    },
    []
  )

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id))
  }, [])

  const duplicatePreset = useCallback((id: string) => {
    setPresets(prev => {
      const original = prev.find(p => p.id === id)
      if (!original) return prev
      const now = new Date().toISOString()
      const clone: Preset = {
        ...original,
        id: uid("preset"),
        name: `${original.name} (복사본)`,
        blocks: cloneBlocks(original.blocks),
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      }
      return [...prev, clone]
    })
  }, [])

  const getPreset = useCallback(
    (id: string) => presets.find(p => p.id === id),
    [presets]
  )

  return { presets, createPreset, updatePreset, deletePreset, duplicatePreset, getPreset }
}
