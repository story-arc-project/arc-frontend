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
      filter: toLibraryFilterDTO(payload.filter) ?? null,
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
  // 서버 계약은 PATCH 다(부분 병합). PUT 은 프론트가 잘못 부르던 시절 백엔드가
  // 같은 핸들러에 덧붙여 준 별칭이라, 그쪽에 기대면 별칭이 정리될 때 다시 405 가 난다.
  await api.patch<ApiSuccessResponse<LibraryIdData>>(
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
