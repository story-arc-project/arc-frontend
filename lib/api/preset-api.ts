import { api } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { Block } from "@/types/archive";
import {
  type PresetDTO,
  toPresetUpsertPayload,
} from "@/lib/utils/preset-mapper";

interface PresetListData {
  count: number;
  contents: PresetDTO[];
}

interface PresetIdData {
  id: string;
}

export async function getPresets(): Promise<PresetDTO[]> {
  const res = await api.get<ApiSuccessResponse<PresetListData>>("/presets/");
  return res.data.contents;
}

export async function getPreset(id: string): Promise<PresetDTO> {
  const res = await api.get<ApiSuccessResponse<PresetDTO>>(`/presets/${id}`);
  return res.data;
}

export async function createPreset(payload: {
  name: string;
  description?: string;
  blocks: Block[];
  isFavorite?: boolean;
}): Promise<PresetDTO> {
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
  const res = await api.put<ApiSuccessResponse<PresetDTO>>(
    `/presets/${id}`,
    toPresetUpsertPayload(payload),
  );
  return res.data;
}

export async function deletePreset(id: string): Promise<void> {
  await api.delete<void>(`/presets/${id}`);
}

export async function duplicatePreset(id: string): Promise<string> {
  const res = await api.post<ApiSuccessResponse<PresetIdData>>(
    `/presets/${id}/duplicate`,
  );
  return res.data.id;
}
