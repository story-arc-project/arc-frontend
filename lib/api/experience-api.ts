import { api, ApiError } from "./client";
import type {
  Experience,
  ExperienceListData,
  ExperienceSavePayload,
  ExperienceUpdatePayload,
  ApiSuccessResponse,
} from "@/types/experience";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

export async function getExperiences(): Promise<ExperienceListData> {
  if (isDemoMode()) return demo.getExperiences();
  const res = await api.get<ApiSuccessResponse<ExperienceListData>>(
    "/experiences/",
  );
  return res.data;
}

export async function getExperience(id: string): Promise<Experience> {
  if (isDemoMode()) return demo.getExperience(id);
  const res = await api.get<ApiSuccessResponse<Experience>>(
    `/experiences/${id}`,
  );
  return res.data;
}

export async function createExperience(
  payload: ExperienceSavePayload,
): Promise<string> {
  if (isDemoMode()) return demo.createExperience(payload);
  const res = await api.post<ApiSuccessResponse<{ id: string }>>(
    "/experiences/",
    payload,
  );
  const newId = res?.data?.id;
  if (typeof newId !== "string" || !newId) {
    throw new ApiError(500, "생성 응답 형식이 올바르지 않아요.");
  }
  return newId;
}

export async function updateExperience(
  id: string,
  payload: ExperienceUpdatePayload,
): Promise<void> {
  if (isDemoMode()) return demo.updateExperience(id, payload);
  await api.put<ApiSuccessResponse<undefined>>(
    `/experiences/${id}`,
    payload,
  );
}

// 중요도 단독 변경은 전용 PATCH 엔드포인트로 보낸다.
// PUT /experiences/{id} 는 content 만 받고 importance 를 무시하므로
// (FRT-39) 인라인 별점 변경은 반드시 이 경로를 사용해야 persist 된다.
export async function updateExperienceImportance(
  id: string,
  importance: number | null,
): Promise<void> {
  if (isDemoMode()) return demo.updateExperienceImportance(id, importance);
  await api.patch<ApiSuccessResponse<undefined>>(
    `/experiences/${id}/importance`,
    { importance },
  );
}

export async function deleteExperience(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteExperience(id);
  await api.delete<void>(`/experiences/${id}`);
}

export async function duplicateExperience(id: string): Promise<string> {
  if (isDemoMode()) return demo.duplicateExperience(id);
  const res = await api.post<ApiSuccessResponse<{ id: string }>>(
    `/experiences/${id}/duplicate`,
  );
  const newId = res?.data?.id;
  if (typeof newId !== "string" || !newId) {
    throw new ApiError(500, "복제 응답 형식이 올바르지 않아요.");
  }
  return newId;
}
