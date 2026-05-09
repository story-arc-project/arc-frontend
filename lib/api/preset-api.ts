import { api } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { Block } from "@/types/archive";
import {
  type PresetDTO,
  toPresetUpsertPayload,
} from "@/lib/utils/preset-mapper";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

interface PresetListData {
  count: number;
  contents: PresetDTO[];
}

interface PresetIdData {
  id: string;
}

export async function getPresets(): Promise<PresetDTO[]> {
  if (isDemoMode()) return demo.getPresets();
  const res = await api.get<ApiSuccessResponse<PresetListData>>("/presets/");
  return res.data.contents;
}

export async function getPreset(id: string): Promise<PresetDTO> {
  if (isDemoMode()) return makeDemoPreset({ id });
  const res = await api.get<ApiSuccessResponse<PresetDTO>>(`/presets/${id}`);
  return res.data;
}

function makeDemoPreset(input: {
  id?: string;
  name?: string;
  description?: string;
  blocks?: Block[];
  isFavorite?: boolean;
}): PresetDTO {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `demo-preset-${Date.now()}`,
    name: input.name ?? "데모 프리셋",
    description: input.description ?? null,
    blocks: input.blocks ?? [],
    is_favorite: input.isFavorite ?? false,
    created_at: now,
    updated_at: now,
  };
}

export async function createPreset(payload: {
  name: string;
  description?: string;
  blocks: Block[];
  isFavorite?: boolean;
}): Promise<PresetDTO> {
  if (isDemoMode()) return makeDemoPreset(payload);
  const res = await api.post<ApiSuccessResponse<PresetDTO>>(
    "/presets/",
    toPresetUpsertPayload(payload),
  );
  return res.data;
}

export async function updatePreset(
  id: string,
  payload: {
    name?: string;
    description?: string;
    blocks?: Block[];
    isFavorite?: boolean;
  },
): Promise<PresetDTO> {
  if (isDemoMode()) return makeDemoPreset({ id, ...payload });
  const res = await api.put<ApiSuccessResponse<PresetDTO>>(
    `/presets/${id}`,
    toPresetUpsertPayload(payload),
  );
  return res.data;
}

export async function deletePreset(id: string): Promise<void> {
  if (isDemoMode()) return;
  await api.delete<void>(`/presets/${id}`);
}

export async function duplicatePreset(id: string): Promise<string> {
  if (isDemoMode()) return `${id}-copy-${Date.now()}`;
  const res = await api.post<ApiSuccessResponse<PresetIdData>>(
    `/presets/${id}/duplicate`,
  );
  return res.data.id;
}
