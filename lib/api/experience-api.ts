import { api, ApiError } from "./client";
import type {
  Experience,
  ExperienceListData,
  ExperienceSavePayload,
  ExperienceUpdatePayload,
  ApiSuccessResponse,
} from "@/types/experience";

export async function getExperiences(): Promise<ExperienceListData> {
  const res = await api.get<ApiSuccessResponse<ExperienceListData>>(
    "/experiences/",
  );
  return res.data;
}

export async function getExperience(id: string): Promise<Experience> {
  const res = await api.get<ApiSuccessResponse<Experience>>(
    `/experiences/${id}`,
  );
  return res.data;
}

export async function createExperience(
  payload: ExperienceSavePayload,
): Promise<Experience> {
  const res = await api.post<ApiSuccessResponse<Experience>>(
    "/experiences/",
    payload,
  );
  return res.data;
}

export async function updateExperience(
  id: string,
  payload: ExperienceUpdatePayload,
): Promise<Experience> {
  const res = await api.put<ApiSuccessResponse<Experience>>(
    `/experiences/${id}`,
    payload,
  );
  return res.data;
}

export async function deleteExperience(id: string): Promise<void> {
  await api.delete<void>(`/experiences/${id}`);
}

export async function duplicateExperience(id: string): Promise<string> {
  const res = await api.post<ApiSuccessResponse<{ id: string }>>(
    `/experiences/${id}/duplicate`,
  );
  const newId = res?.data?.id;
  if (typeof newId !== "string" || !newId) {
    throw new ApiError(500, "복제 응답 형식이 올바르지 않아요.");
  }
  return newId;
}
