import type { Library, LibraryFilter } from "@/types/archive";

export const ALL_LIBRARY_ID = "lib-all";

export interface LibraryFilterDTO {
  search?: string;
  sortBy?: LibraryFilter["sortBy"];
  types?: NonNullable<LibraryFilter["typeIds"]>;
  statuses?: LibraryFilter["statuses"];
  tags?: LibraryFilter["tags"];
}

export interface LibraryDTO {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  is_system: boolean;
  filter?: LibraryFilterDTO | null;
}

export interface LibraryUpsertPayload {
  name?: string;
  color?: string;
  icon?: string;
  is_system?: boolean;
  filter?: LibraryFilterDTO;
}

export function toLibraryFilter(dto?: LibraryFilterDTO | null): LibraryFilter | undefined {
  if (!dto) return undefined;

  return {
    search: dto.search,
    sortBy: dto.sortBy,
    typeIds: dto.types,
    statuses: dto.statuses,
    tags: dto.tags,
  };
}

export function toLibrary(dto: LibraryDTO, experienceIds: string[] = []): Library {
  return {
    id: dto.id,
    name: dto.name,
    color: dto.color ?? undefined,
    icon: dto.icon ?? undefined,
    isSystem: dto.is_system,
    experienceIds,
    filter: toLibraryFilter(dto.filter),
  };
}

export function toLibraryFilterDTO(filter?: LibraryFilter): LibraryFilterDTO | undefined {
  if (!filter) return undefined;

  return {
    search: filter.search,
    sortBy: filter.sortBy,
    types: filter.typeIds,
    statuses: filter.statuses,
    tags: filter.tags,
  };
}

export function toLibraryUpsertPayload(input: {
  name?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
  filter?: LibraryFilter;
}): LibraryUpsertPayload {
  return {
    name: input.name,
    color: input.color,
    icon: input.icon,
    is_system: input.isSystem,
    filter: toLibraryFilterDTO(input.filter),
  };
}

export function createAllLibrary(): Library {
  return {
    id: ALL_LIBRARY_ID,
    name: "전체",
    isSystem: true,
    experienceIds: [],
  };
}
