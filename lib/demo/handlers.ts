// 데모 모드 API 핸들러.
// 실제 lib/api/*-api.ts 함수와 동일한 시그니처로 시드/스토어 데이터를 반환한다.
//
// 분석(analysis) 영역은 lib/api/mocks/analysis.ts 가 이미 완전한 mock 을 제공하므로
// analysis-api.ts 에서 USE_MOCK || isDemoMode() 분기를 사용하고, 여기서는 다루지 않는다.

import type {
  Experience,
  ExperienceListData,
  ExperienceSavePayload,
  ExperienceUpdatePayload,
} from "@/types/experience";
import type { LibraryDTO, LibraryUpsertPayload } from "@/lib/utils/library-mapper";
import type { PresetDTO, PresetUpsertPayload } from "@/lib/utils/preset-mapper";
import type { ResumeLanguage, ResumeListItem, ResumeVersion } from "@/types/resume";
import type { AuthUser } from "@/types/auth";

import { experienceStore, libraryStore, presetStore, resumeStore } from "./store";
import { seedResumeListItem, DEMO_RESUME_VERSION_ID } from "./seed";

// 짧은 인공 지연으로 실제 API 호출처럼 보이게 한다.
function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ─── Experience ─────────────────────────────────────────────

export async function getExperiences(): Promise<ExperienceListData> {
  const list = experienceStore.list();
  return delay({ count: list.length, contents: list });
}

export async function getExperience(id: string): Promise<Experience> {
  const exp = experienceStore.get(id);
  if (!exp) throw new Error("not found");
  return delay(exp);
}

export async function createExperience(payload: ExperienceSavePayload): Promise<string> {
  const id = experienceStore.create(payload);
  return delay(id);
}

export async function updateExperience(id: string, payload: ExperienceUpdatePayload): Promise<void> {
  experienceStore.update(id, payload);
  await delay(undefined);
}

export async function deleteExperience(id: string): Promise<void> {
  experienceStore.delete(id);
  await delay(undefined);
}

export async function duplicateExperience(id: string): Promise<string> {
  const newId = experienceStore.duplicate(id);
  return delay(newId);
}

// ─── Library ────────────────────────────────────────────────

export async function getLibraries(): Promise<LibraryDTO[]> {
  return delay(libraryStore.list());
}

export async function createLibrary(payload: LibraryUpsertPayload): Promise<string> {
  const id = libraryStore.create(payload);
  return delay(id);
}

export async function updateLibrary(id: string, payload: LibraryUpsertPayload): Promise<void> {
  libraryStore.update(id, payload);
  await delay(undefined);
}

export async function deleteLibrary(id: string): Promise<void> {
  libraryStore.delete(id);
  await delay(undefined);
}

export async function getLibraryExperiences(id: string): Promise<ExperienceListData> {
  const list = libraryStore.experiencesIn(id);
  return delay({ count: list.length, contents: list });
}

export async function addExperienceToLibrary(libraryId: string, experienceId: string): Promise<void> {
  libraryStore.addExperience(libraryId, experienceId);
  await delay(undefined);
}

export async function removeExperienceFromLibrary(libraryId: string, experienceId: string): Promise<void> {
  libraryStore.removeExperience(libraryId, experienceId);
  await delay(undefined);
}

// ─── Preset ─────────────────────────────────────────────────

export async function getPresets(): Promise<PresetDTO[]> {
  return delay(presetStore.list());
}

export async function getPreset(id: string): Promise<PresetDTO> {
  const found = presetStore.get(id);
  if (!found) throw new Error("not found");
  return delay(found);
}

export async function createPreset(payload: PresetUpsertPayload): Promise<PresetDTO> {
  return delay(presetStore.create(payload));
}

export async function updatePreset(id: string, payload: PresetUpsertPayload): Promise<PresetDTO> {
  return delay(presetStore.update(id, payload));
}

export async function deletePreset(id: string): Promise<void> {
  presetStore.delete(id);
  await delay(undefined);
}

export async function duplicatePreset(id: string): Promise<string> {
  return delay(presetStore.duplicate(id));
}

// ─── Auth ───────────────────────────────────────────────────

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  // 데모 방문자를 인증된 사용자로 캐시하면 안 된다.
  // 그럴 경우 데모 종료 후 /signup·/login 으로 이동했을 때
  // useRedirectIfAuthenticated() 가 곧장 /dashboard 로 보내버려
  // 회원가입 흐름이 차단된다 (Codex P1).
  return delay(null);
}

export async function logoutUser(): Promise<void> {
  // 데모에서는 로그아웃이 의미가 없다.
  await delay(undefined);
}

// ─── Resume (Export) ────────────────────────────────────────

export async function createResume(params: { language: ResumeLanguage }): Promise<ResumeVersion> {
  void params; // 데모는 언어 무관하게 동일 시드를 반환한다
  return delay(resumeStore.get(), 600);
}

export async function getResume(versionId: string): Promise<ResumeVersion> {
  void versionId;
  return delay(resumeStore.get());
}

export async function getResumeList(): Promise<ResumeListItem[]> {
  return delay([seedResumeListItem]);
}

export async function updateResume(versionId: string, data: ResumeVersion): Promise<ResumeVersion> {
  void versionId;
  return delay(data);
}

export async function deleteResume(versionId: string): Promise<void> {
  void versionId;
  await delay(undefined);
}

export const DEMO_RESUME_ID = DEMO_RESUME_VERSION_ID;
