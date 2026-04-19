import type { Block, Preset } from "@/types/archive";

export interface PresetDTO {
  id: string;
  user_id?: string;
  name: string;
  description?: string | null;
  blocks: Block[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface PresetUpsertPayload {
  name?: string;
  description?: string;
  blocks?: Block[];
  is_favorite?: boolean;
}

export function toPreset(dto: PresetDTO): Preset {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? undefined,
    blocks: dto.blocks ?? [],
    isFavorite: dto.is_favorite,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toPresetUpsertPayload(input: {
  name?: string;
  description?: string;
  blocks?: Block[];
  isFavorite?: boolean;
}): PresetUpsertPayload {
  const payload: PresetUpsertPayload = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.blocks !== undefined) payload.blocks = input.blocks;
  if (input.isFavorite !== undefined) payload.is_favorite = input.isFavorite;
  return payload;
}
