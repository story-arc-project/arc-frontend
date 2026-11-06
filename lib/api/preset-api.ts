import { api } from "./client";
import { ApiError } from "./api-error";
import type { Block } from "@/types/archive";
import {
  type PresetDTO,
  toPresetUpsertPayload,
} from "@/lib/utils/preset-mapper";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalidResponse(): ApiError {
  return new ApiError(502, "프리셋 응답을 확인하지 못했어요. 다시 시도해 주세요.", "INVALID_RESPONSE");
}

function responseData(response: unknown): unknown {
  if (!isRecord(response)) throw invalidResponse();
  return response.data;
}

function isPreset(value: unknown): value is PresetDTO {
  return isRecord(value)
    && isId(value.id)
    && typeof value.name === "string"
    && (value.user_id === undefined || typeof value.user_id === "string")
    && (value.description === undefined || value.description === null || typeof value.description === "string")
    && Array.isArray(value.blocks)
    // Backend blocks are arbitrary dictionaries. Keep future kinds and their
    // nested payloads intact rather than normalizing or filtering them.
    && value.blocks.every(isRecord)
    && typeof value.is_favorite === "boolean"
    && typeof value.created_at === "string"
    && typeof value.updated_at === "string";
}

function parsePreset(response: unknown): PresetDTO {
  const data = responseData(response);
  if (!isPreset(data)) throw invalidResponse();
  return data;
}

export async function getPresets(): Promise<PresetDTO[]> {
  if (isDemoMode()) return demo.getPresets();
  const res = await api.get<unknown>("/presets/");
  const data = responseData(res);
  if (!isRecord(data) || !Array.isArray(data.contents) || !data.contents.every(isPreset)) {
    // Reject the whole response: an empty/filtered fallback would hide cached
    // presets and make a partial result look like a successful complete list.
    throw invalidResponse();
  }
  return data.contents;
}

export async function getPreset(id: string): Promise<PresetDTO> {
  if (isDemoMode()) return demo.getPreset(id);
  const res = await api.get<unknown>(`/presets/${id}`);
  return parsePreset(res);
}

export async function createPreset(payload: {
  name: string;
  description?: string;
  blocks: Block[];
  isFavorite?: boolean;
}): Promise<PresetDTO> {
  if (isDemoMode()) return demo.createPreset(toPresetUpsertPayload(payload));
  const res = await api.post<unknown>(
    "/presets/",
    toPresetUpsertPayload(payload),
  );
  return parsePreset(res);
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
  if (isDemoMode()) return demo.updatePreset(id, toPresetUpsertPayload(payload));
  const res = await api.put<unknown>(
    `/presets/${id}`,
    toPresetUpsertPayload(payload),
  );
  return parsePreset(res);
}

export async function deletePreset(id: string): Promise<void> {
  if (isDemoMode()) return demo.deletePreset(id);
  await api.delete<void>(`/presets/${id}`);
}

export async function duplicatePreset(id: string): Promise<string> {
  if (isDemoMode()) return demo.duplicatePreset(id);
  const res = await api.post<unknown>(
    `/presets/${id}/duplicate`,
  );
  const data = responseData(res);
  if (!isRecord(data) || !isId(data.id)) throw invalidResponse();
  return data.id;
}
