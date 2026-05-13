import { api } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExperienceListData } from "@/types/experience";
import type { LibraryFilter } from "@/types/archive";
import {
  type LibraryDTO,
  toLibraryUpsertPayload,
  toLibraryFilterDTO,
} from "@/lib/utils/library-mapper";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

interface LibraryIdData {
  id: string;
}

interface LibraryListData {
  count: number;
  contents: {
    system: LibraryDTO[];
    custom: LibraryDTO[];
  };
}

export async function getLibraries(): Promise<LibraryDTO[]> {
  if (isDemoMode()) return demo.getLibraries();
  const res = await api.get<ApiSuccessResponse<LibraryListData>>("/libraries/");
  const { system, custom } = res.data.contents;
  return [...system, ...custom];
}

export async function createLibrary(payload: {
  name: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
  filter?: LibraryFilter;
}): Promise<string> {
  if (isDemoMode()) return demo.createLibrary(toLibraryUpsertPayload(payload));
  const res = await api.post<ApiSuccessResponse<LibraryIdData>>(
    "/libraries/",
    {
      name: payload.name,
      color: payload.color ?? "",
      icon: payload.icon ?? "",
      is_system: payload.isSystem ?? false,
      filter: toLibraryFilterDTO(payload.filter) ?? {},
    },
  );
  return res.data.id;
}

export async function updateLibrary(
  id: string,
  payload: {
    name?: string;
    color?: string;
    icon?: string;
    isSystem?: boolean;
    filter?: LibraryFilter;
  },
): Promise<void> {
  if (isDemoMode()) return demo.updateLibrary(id, toLibraryUpsertPayload(payload));
  await api.put<ApiSuccessResponse<LibraryIdData>>(
    `/libraries/${id}`,
    toLibraryUpsertPayload(payload),
  );
}

export async function deleteLibrary(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteLibrary(id);
  await api.delete<void>(`/libraries/${id}`);
}

export async function getLibraryExperiences(id: string): Promise<ExperienceListData> {
  if (isDemoMode()) return demo.getLibraryExperiences(id);
  const res = await api.get<ApiSuccessResponse<ExperienceListData>>(
    `/libraries/${id}/experiences`,
  );
  return res.data;
}

export async function addExperienceToLibrary(libraryId: string, experienceId: string): Promise<void> {
  if (isDemoMode()) return demo.addExperienceToLibrary(libraryId, experienceId);
  await api.post<void>(`/libraries/${libraryId}/experiences/${experienceId}`);
}

export async function removeExperienceFromLibrary(libraryId: string, experienceId: string): Promise<void> {
  if (isDemoMode()) return demo.removeExperienceFromLibrary(libraryId, experienceId);
  await api.delete<void>(`/libraries/${libraryId}/experiences/${experienceId}`);
}
