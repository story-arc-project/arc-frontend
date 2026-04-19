import { api } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { ExperienceListData } from "@/types/experience";
import type { LibraryFilter } from "@/types/archive";
import {
  type LibraryDTO,
  toLibraryUpsertPayload,
} from "@/lib/utils/library-mapper";

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
  const res = await api.post<ApiSuccessResponse<LibraryIdData>>(
    "/libraries/",
    toLibraryUpsertPayload(payload),
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
  await api.put<ApiSuccessResponse<LibraryIdData>>(
    `/libraries/${id}`,
    toLibraryUpsertPayload(payload),
  );
}

export async function deleteLibrary(id: string): Promise<void> {
  await api.delete<void>(`/libraries/${id}`);
}

export async function getLibraryExperiences(id: string): Promise<ExperienceListData> {
  const res = await api.get<ApiSuccessResponse<ExperienceListData>>(
    `/libraries/${id}/experiences`,
  );
  return res.data;
}

export async function addExperienceToLibrary(libraryId: string, experienceId: string): Promise<void> {
  await api.post<void>(`/libraries/${libraryId}/experiences/${experienceId}`);
}

export async function removeExperienceFromLibrary(libraryId: string, experienceId: string): Promise<void> {
  await api.delete<void>(`/libraries/${libraryId}/experiences/${experienceId}`);
}
