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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExperience(value: unknown): value is Experience {
  if (!isRecord(value)) return false;
  return ["id", "user_id", "type", "created_at", "updated_at"].every(
    (key) => typeof value[key] === "string" && value[key].length > 0,
  ) && (value.importance === null || (
    typeof value.importance === "number" && Number.isInteger(value.importance)
  )) && isRecord(value.content);
}

function isExperienceList(value: unknown): value is ExperienceListData {
  return isRecord(value)
    && typeof value.count === "number"
    && Number.isSafeInteger(value.count)
    && value.count >= 0
    && Array.isArray(value.contents)
    && value.contents.every(isExperience);
}

export async function getExperiences(): Promise<ExperienceListData> {
  if (isDemoMode()) return demo.getExperiences();
  const res = await api.get<unknown>("/experiences/");
  if (!isRecord(res) || !isExperienceList(res.data)) {
    throw new ApiError(500, "경험 목록 응답 형식이 올바르지 않아요.");
  }
  return res.data;
}

export async function getExperience(id: string): Promise<Experience> {
  if (isDemoMode()) return demo.getExperience(id);
  const res = await api.get<unknown>(`/experiences/${id}`);
  if (!isRecord(res) || !isExperience(res.data)) {
    throw new ApiError(500, "경험 상세 응답 형식이 올바르지 않아요.");
  }
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
